import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const response = await axios.post(
      process.env.AI_MODEL_URL,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: req.body.prompt }]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        }
      }
    );

    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/test", (req, res) => {
  res.send("IA online");
});

export default router;
