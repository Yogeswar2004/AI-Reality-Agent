import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDB } from "../config/db.js";

const router = express.Router();

// ==============================
// REGISTER USER
// ==============================
router.post("/register", async (req, res) => {
try {
const { name, email, password } = req.body;


if (!name || !email || !password) {
  return res.status(400).json({
    success: false,
    message: "Name, email, and password are required",
  });
}

const normalizedEmail = email.toLowerCase().trim();

const db = getDB();
const usersCollection = db.collection("users");

const existingUser = await usersCollection.findOne({
  email: normalizedEmail,
});

if (existingUser) {
  return res.status(409).json({
    success: false,
    message: "An account with this email already exists",
  });
}

const hashedPassword = await bcrypt.hash(password, 12);

const newUser = {
  name: name.trim(),
  email: normalizedEmail,
  password: hashedPassword,
  createdAt: new Date(),
};

const result = await usersCollection.insertOne(newUser);

const token = jwt.sign(
  {
    userId: result.insertedId.toString(),
    email: newUser.email,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
  }
);

return res.status(201).json({
  success: true,
  message: "Account created successfully",
  token,
  user: {
    id: result.insertedId,
    name: newUser.name,
    email: newUser.email,
  },
});


} catch (error) {
console.error("Registration error:", error);


return res.status(500).json({
  success: false,
  message: "Failed to create account",
});


}
});

// ==============================
// LOGIN USER
// ==============================
router.post("/login", async (req, res) => {
try {
const { email, password } = req.body;


if (!email || !password) {
  return res.status(400).json({
    success: false,
    message: "Email and password are required",
  });
}

const normalizedEmail = email.toLowerCase().trim();

const db = getDB();
const usersCollection = db.collection("users");

const user = await usersCollection.findOne({
  email: normalizedEmail,
});

if (!user) {
  return res.status(401).json({
    success: false,
    message: "Invalid email or password",
  });
}

const passwordMatches = await bcrypt.compare(
  password,
  user.password
);

if (!passwordMatches) {
  return res.status(401).json({
    success: false,
    message: "Invalid email or password",
  });
}

const token = jwt.sign(
  {
    userId: user._id.toString(),
    email: user.email,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
  }
);

return res.status(200).json({
  success: true,
  message: "Login successful",
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
  },
});


} catch (error) {
console.error("Login error:", error);


return res.status(500).json({
  success: false,
  message: "Login failed",
});


}
});

export default router;
