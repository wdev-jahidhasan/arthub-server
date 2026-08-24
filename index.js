const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("artHub");
    const userCollection = db.collection("user");

    // Profile update
    app.patch('/api/users/update', async (req, res) => {
      const { email, name, image } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const filter = { email: email };
      const updatedDoc = {
        $set: {
          name: name,
          image: image,
        },
      };

      const result = await userCollection.updateOne(filter, updatedDoc);

      res.send({
        success: true,
        message: "Profile updated successfully",
        result,
      });
    });


    // main catch block -----
  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("SERVER IS TOTALLY OKAY");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});