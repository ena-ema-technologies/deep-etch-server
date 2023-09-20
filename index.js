const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.hc5ickt.mongodb.net/?retryWrites=true&w=majority`;


app.use(cors());
app.use(express.json());






// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    const serviceCollection = client.db("deepEtch").collection("services");
    try {


        app.get("/all-service", async (req, res) => {
            const result = await serviceCollection.find({}).toArray();
            res.send(result)
        })
        
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Server successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get("/", (req, res) => {
    res.send("Deep Etch server is running")
})

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
})