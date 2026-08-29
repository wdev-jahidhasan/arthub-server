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
    const subscriptionCollection = db.collection("subscriptions");
    const purchaseCollection = db.collection("purchases");

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

    // Get artworks by specific artist ID
    app.get('/api/artworks/user/:userId', async (req, res) => {
      const userId = req.params.userId;
      const query = { artistId: userId };
      const result = await artworkCollection.find(query).toArray();

      res.send({
        success: true,
        data: result,
      });
    });


    // subscription saving and plan updating related
    app.post('/subscription', async (req, res) => {
      const { sessionId, userId, priceId } = req.body;

      const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
      const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID;

      let planType = 'free';
      if (priceId === PRO_PRICE_ID) {
        planType = 'Pro';
      } else if (priceId === PREMIUM_PRICE_ID) {
        planType = 'Premium';
      }

      isExist = await subscriptionCollection.findOne({ sessionId })

      if (isExist) {
        return res.json({ msg: "Payment already done" })
      }

      await subscriptionCollection.insertOne({
        sessionId,
        userId,
        priceId,
        plan: planType,
        createdAt: new Date()
      });

      // update user role
      await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            plan: planType,
          }
        }
      );

      res.json({ success: true, msg: "Subscription updated successfully!" });
    });

    // save purchase related payment to db
    app.post('/api/purchases', async (req, res) => {
      const { sessionId, paymentIntentId, customerEmail, amountTotal, currency, metadata, status } = req.body;

      const existingPurchase = await db.collection("purchases").findOne({ sessionId });

      if (existingPurchase) {
        return res.json({ success: true, message: "Purchase already recorded" });
      }

      const result = await db.collection("purchases").insertOne({
        sessionId,
        paymentIntentId,
        customerEmail,
        amountTotal,
        currency,
        metadata,
        status,
        createdAt: new Date(),
      });

      res.json({ success: true, message: "Purchase saved successfully", result });
    });

    // get purchased artworks
    app.get('/api/purchases', async (req, res) => {
      const userId = req.query.userId;

      const query = userId ? { "metadata.userId": userId } : {};

      const result = await purchaseCollection.find(query).sort({ createdAt: -1 }).toArray();

      res.send({
        success: true,
        data: result,
      });
    });

    // post review to db
    app.post('/api/reviews', async (req, res) => {
      try {
        const { artworkId, comment, userEmail, userId } = req.body;

        const newComment = {
          artworkId,
          comment,
          userEmail: userEmail || "Anonymous",
          userId: userId || null,
          createdAt: new Date(),
        };

        const result = await db.collection("reviews").insertOne(newComment);

        res.status(201).json({ success: true, message: "Comment posted successfully", result });
      } catch (error) {
        console.error("Error in /api/reviews:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // reviews by specific user ID
    app.get('/api/reviews/user/:userId', async (req, res) => {
      try {
        const userId = req.params.userId;
        const query = { userId: userId };
        const result = await db.collection("reviews").find(query).sort({ createdAt: -1 }).toArray();

        res.send({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Update a review
    app.patch('/api/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { comment } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            comment: comment,
            updatedAt: new Date(),
          },
        };

        const result = await db.collection("reviews").updateOne(filter, updatedDoc);
        res.send({ success: true, message: "Review updated successfully", result });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Delete a review
    app.delete('/api/reviews/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await db.collection("reviews").deleteOne(query);

        res.send({ success: true, message: "Review deleted successfully", result });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });


    //  get purchased artworks and comments by id
    app.get('/api/purchases/user-safe/:userId', async (req, res) => {
      const userId = req.params.userId;

      const purchases = await db.collection("purchases").find({
        $or: [
          { userId: userId },
          { "metadata.userId": userId },
          { customerEmail: userId }
        ]
      }).toArray();

      const detailedPurchases = await Promise.all(
        purchases.map(async (purchase) => {
          let artId = purchase.artworkId || purchase.metadata?.artworkId;

          let artwork = null;
          if (artId) {
            try {
              artwork = await db.collection("artworks").findOne({ _id: new ObjectId(artId) });
            } catch (e) {
              artwork = null;
            }
          }

          return {
            ...purchase,
            artworkDetails: artwork
          };
        })
      );

      res.send({
        success: true,
        data: detailedPurchases,
      });
    });

    // Update an artwork
    app.patch('/api/artworks/:id', async (req, res) => {
      const id = req.params.id;
      const { title, description, price } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...(title && { title }),
          ...(description && { description }),
          ...(price !== undefined && { price: Number(price) }),
          updatedAt: new Date(),
        },
      };

      const result = await artworkCollection.updateOne(filter, updatedDoc);

      res.send({
        success: true,
        message: "Artwork updated successfully",
        result
      });
    });

    // Delete an artwork
    app.delete('/api/artworks/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await artworkCollection.deleteOne(query);

      res.send({
        success: true,
        message: "Artwork deleted successfully",
        result
      });
    });

    // Get sales history for a specific artist
    app.get('/api/sales/artist/:userId', async (req, res) => {
      const artistId = req.params.userId;

      const artistArtworks = await artworkCollection.find({ artistId: artistId }).toArray();
      const artworkIdsStr = artistArtworks.map(art => art._id.toString());
      const artworkIdsObj = artistArtworks.map(art => art._id);

      const purchases = await purchaseCollection.find({
        $or: [
          { artworkId: { $in: artworkIdsStr } },
          { artworkId: { $in: artworkIdsObj } },
          { "metadata.artworkId": { $in: artworkIdsStr } },
          { "metadata.artworkId": { $in: artworkIdsObj } }
        ]
      }).sort({ createdAt: -1 }).toArray();

      const detailedSales = await Promise.all(
        purchases.map(async (purchase) => {
          let artId = purchase.artworkId || purchase.metadata?.artworkId;

          let artwork = null;
          if (artId) {
            const queryId = typeof artId === 'string' && artId.length === 24 ? new ObjectId(artId) : artId;
            artwork = await artworkCollection.findOne({
              $or: [{ _id: queryId }, { _id: artId }]
            });
          }

          return {
            ...purchase,
            artwork: artwork,
            totalAmount: purchase.amountTotal || purchase.metadata?.price || 0
          };
        })
      );

      res.send({
        success: true,
        data: detailedSales,
      });
    });

    // Get analytics summary with sales data
    app.get('/api/analytics/artist/:userId', async (req, res) => {
      const artistId = req.params.userId;

      const artistArtworks = await artworkCollection.find({ artistId: artistId }).toArray();
      const totalArtworks = artistArtworks.length;

      const artworkIdsStr = artistArtworks.map(art => art._id.toString());
      const artworkIdsObj = artistArtworks.map(art => art._id);

      const purchases = await purchaseCollection.find({
        $or: [
          { artworkId: { $in: artworkIdsStr } },
          { artworkId: { $in: artworkIdsObj } },
          { "metadata.artworkId": { $in: artworkIdsStr } },
          { "metadata.artworkId": { $in: artworkIdsObj } }
        ]
      }).sort({ createdAt: -1 }).toArray();

      const totalSalesCount = purchases.length;
      const totalEarnings = purchases.reduce((acc, purchase) => {
        const amount = purchase.amountTotal || Number(purchase.metadata?.price) || 0;
        return acc + amount;
      }, 0);

      res.send({
        success: true,
        data: {
          totalEarnings,
          totalSalesCount,
          totalArtworks,
          purchases
        }
      });
    });

    // Get all users for admin
    app.get('/api/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send({ success: true, data: result });
    });

    // Update user role (user / artist / admin)
    app.patch('/api/users/role/:id', async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
          updatedAt: new Date()
        }
      };

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send({ success: true, message: "User role updated successfully", result });
    });

    // Admin Analytics & Charts api
    app.get('/api/admin/analytics', async (req, res) => {
      const totalUsers = await userCollection.countDocuments({
        role: "user"
      });

      const totalArtists = await userCollection.countDocuments({
        role: "artist"
      });

      const totalArtworksSold = await purchaseCollection.countDocuments();

      // Total Revenue Calculation
      const revenueResult = await purchaseCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $cond: [
                  { $gt: ["$amountTotal", null] },
                  "$amountTotal",
                  { $toDecimal: { $ifNull: ["$metadata.price", 0] } }
                ]
              }
            }
          }
        }
      ]).toArray();

      const totalRevenue = revenueResult.length > 0 ? Number(revenueResult[0].totalRevenue) : 0;
      const finalRevenue = totalRevenue > 10000 ? totalRevenue / 100 : totalRevenue;

      // Artworks by Category (Pie Chart Data)
      const categoryData = await artworkCollection.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$category", "General"] },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            value: "$count"
          }
        }
      ]).toArray();

      // Sales Chart Data grouped by date
      const salesData = await purchaseCollection.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            sales: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $gt: ["$amountTotal", null] },
                  "$amountTotal",
                  { $toDecimal: { $ifNull: ["$metadata.price", 0] } }
                ]
              }
            }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            sales: "$sales",
            revenue: "$revenue"
          }
        }
      ]).toArray();

      res.send({
        success: true,
        data: {
          totalUsers,
          totalArtists,
          totalArtworksSold,
          totalRevenue: finalRevenue,
          categoryData,
          salesData
        }
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