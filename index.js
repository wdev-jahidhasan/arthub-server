const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const artworkCollection = db.collection("artworks");

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
          updatedAt: new Date(),
        },
      };

      const result = await userCollection.updateOne(filter, updatedDoc);

      res.send({
        success: true,
        message: "Profile updated successfully",
        result,
      });
    });

    // add new artwork by artist
    app.post('/api/artworks/add', async (req, res) => {
      const artworkData = req.body;

      const newArtwork = {
        ...artworkData,
        price: Number(artworkData.price),
        createdAt: new Date(),
      };

      const result = await artworkCollection.insertOne(newArtwork);

      res.send({
        success: true,
        message: "Artwork published successfully",
        result,
      });
    });

    // get all artworks (newest first)
    app.get('/api/artworks', async (req, res) => {
      const result = await artworkCollection.find().sort({ createdAt: -1 }).toArray();

      res.send({
        success: true,
        data: result,
      });
    });

    // get artworks (featured)
    app.get('/api/artworks/featured', async (req, res) => {
      const result = await artworkCollection.find().sort({ createdAt: 1 }).limit(6).toArray();

      res.send({
        success: true,
        data: result,
      });
    });

    // get single artwork details
    app.get('/api/artworks/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artworkCollection.findOne(query);

      res.send({
        success: true,
        data: result,
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