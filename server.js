import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: "*" }));

app.get("/", (req, res) => {
  const id = req.query.id || "no-id";

  res.json({
    success: true,
    message: "Backend working",
    id: id,
    time: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
