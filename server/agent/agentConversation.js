import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const AGENT_CONVERSATIONS_COLLECTION = "agent_conversations";

/**
 * Serialize MongoDB conversation document.
 */
const serializeConversation = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id?.toString() || doc._id,
    userId: doc.userId?.toString() || doc.userId,
    activeRunId: doc.activeRunId?.toString() || doc.activeRunId || null,
  };
};

/**
 * Create a new agent conversation thread.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Owner user identifier.
 * @param {string} [params.title="New Investigation"] - Conversation title.
 * @param {string|ObjectId|null} [params.activeRunId=null] - Currently active agent run ID.
 * @returns {Promise<Object>} Created conversation document.
 */
const createConversation = async ({
  userId,
  title = "New Investigation",
  activeRunId = null,
}) => {
  if (!userId) {
    throw new Error("userId is required to create a conversation");
  }

  const cleanTitle =
    typeof title === "string" && title.trim()
      ? title.trim().slice(0, 100)
      : "New Investigation";

  const now = new Date();
  const doc = {
    userId: String(userId),
    title: cleanTitle,
    activeRunId: activeRunId ? new ObjectId(String(activeRunId)) : null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const db = getDB();
  const result = await db.collection(AGENT_CONVERSATIONS_COLLECTION).insertOne(doc);

  return serializeConversation({
    _id: result.insertedId,
    ...doc,
  });
};

/**
 * Fetch a single conversation by ID with strict userId scoping.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.id - Conversation ID.
 * @param {string|ObjectId} params.userId - Owner user identifier.
 * @returns {Promise<Object|null>}
 */
const getConversationById = async ({ id, userId }) => {
  if (!ObjectId.isValid(id) || !userId) {
    return null;
  }

  const db = getDB();
  const doc = await db.collection(AGENT_CONVERSATIONS_COLLECTION).findOne({
    _id: new ObjectId(String(id)),
    userId: String(userId),
  });

  return serializeConversation(doc);
};

/**
 * List recent conversations for a user.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Owner user identifier.
 * @param {number} [params.limit=20] - Maximum conversations to return.
 * @returns {Promise<Array<Object>>}
 */
const listConversations = async ({ userId, limit = 20 }) => {
  if (!userId) return [];

  const maxLimit = Math.max(1, Math.min(limit, 50));
  const db = getDB();
  const docs = await db
    .collection(AGENT_CONVERSATIONS_COLLECTION)
    .find({
      userId: String(userId),
      status: { $ne: "deleted" },
    })
    .sort({ updatedAt: -1 })
    .limit(maxLimit)
    .toArray();

  return docs.map(serializeConversation);
};

/**
 * Update the active run linked to this conversation.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.conversationId
 * @param {string|ObjectId} params.userId
 * @param {string|ObjectId|null} params.activeRunId
 * @returns {Promise<Object|null>}
 */
const updateConversationActiveRun = async ({
  conversationId,
  userId,
  activeRunId,
}) => {
  if (!ObjectId.isValid(conversationId) || !userId) {
    return null;
  }

  const db = getDB();
  const runOid = activeRunId && ObjectId.isValid(activeRunId)
    ? new ObjectId(String(activeRunId))
    : null;

  const result = await db.collection(AGENT_CONVERSATIONS_COLLECTION).findOneAndUpdate(
    {
      _id: new ObjectId(String(conversationId)),
      userId: String(userId),
    },
    {
      $set: {
        activeRunId: runOid,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return serializeConversation(result?.value || result);
};

/**
 * Update conversation title (e.g. once user goal is clarified).
 *
 * @param {Object} params
 * @param {string|ObjectId} params.conversationId
 * @param {string|ObjectId} params.userId
 * @param {string} params.title
 * @returns {Promise<Object|null>}
 */
const updateConversationTitle = async ({ conversationId, userId, title }) => {
  if (!ObjectId.isValid(conversationId) || !userId || !title) {
    return null;
  }

  const cleanTitle = String(title).trim().slice(0, 100);
  const db = getDB();
  const result = await db.collection(AGENT_CONVERSATIONS_COLLECTION).findOneAndUpdate(
    {
      _id: new ObjectId(String(conversationId)),
      userId: String(userId),
    },
    {
      $set: {
        title: cleanTitle,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return serializeConversation(result?.value || result);
};

/**
 * Ensure compound indexes on agent_conversations collection.
 */
const ensureAgentConversationIndexes = async () => {
  const db = getDB();
  const collection = db.collection(AGENT_CONVERSATIONS_COLLECTION);
  await collection.createIndex({ userId: 1, updatedAt: -1 });
  await collection.createIndex({ activeRunId: 1 });
  console.log(
    "Indexes ensured on agent_conversations: { userId: 1, updatedAt: -1 }, { activeRunId: 1 }"
  );
};

export {
  AGENT_CONVERSATIONS_COLLECTION,
  createConversation,
  getConversationById,
  listConversations,
  updateConversationActiveRun,
  updateConversationTitle,
  ensureAgentConversationIndexes,
};

