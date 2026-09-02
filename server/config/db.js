import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

let db;

const connectDB = async () => {
try {
await client.connect();


db = client.db("ideaRealityDB");

console.log("MongoDB connected successfully");

return db;


} catch (error) {
console.error(
"MongoDB connection failed:",
error.message
);


process.exit(1);


}
};

const getDB = () => {
if (!db) {
throw new Error(
"Database is not connected. Call connectDB first."
);
}

return db;
};

export { connectDB, getDB, client };
