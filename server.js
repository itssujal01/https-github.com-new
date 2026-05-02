import express from "express";
import axios from "axios";

const app = express();

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/fetch", async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "User ID required"
      });
    }

    const userData = {
      id: id,
      name: "Demo User",
      profilePic: "https://via.placeholder.com/150",
      email: "c**********r@gmail.com",
      goldPrice: "₹45",
      extraGold: "60"
    };

    return res.json({
      success: true,
      data: userData
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
