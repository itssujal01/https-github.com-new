const express = require("express");
const axios = require("axios");
const app = express();

// Root check
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ MAIN FETCH API
app.get("/fetch", async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "User ID required"
      });
    }

    // 🔥 Example external fetch (abhi dummy hai)
    // yahan baad me real data fetch karenge
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

// Server start
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
