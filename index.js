const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.hc5ickt.mongodb.net/?retryWrites=true&w=majority`;


app.use(cors());
app.use(express.json());


const verifyToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      req.user = decoded;
      next();
    });
  };



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
    const testimonialCollection = client.db("deepEtch").collection("testimonial");
    const usersCollection = client.db("deepEtch").collection("users")
    try {


        app.get("/all-service", async (req, res) => {
            const result = await serviceCollection.find({}).toArray();
            res.send(result)
        })

        app.get("/client-testimonial", async(req,res)=>{
            const result = await testimonialCollection.find({}).toArray();
            res.send(result)
        })



        app.post('/user/sigUp', async (req, res) => {
            const { name, role, phone, email, password, photo, clientPosition,clientCompany,clientCountry, agreeWithTermsConditions } = req.body;
          
            try {
              // Check if user already exists
              const user = await usersCollection.findOne({ email });
              if (user) {
                return res.status(409).json({ message: 'User already exists' });
              }
          
              // Hash the password
              const hashedPassword = await bcrypt.hash(password, 10);
          
              // Save the user to the database
              await usersCollection.insertOne({
                name,
                role,
                phone,
                email,
                password: hashedPassword,
                photo,
                clientPosition,
                clientCompany,
                clientCountry,
                agreeWithTermsConditions
              });
          
              // Generate a JWT token
              const token = jwt.sign({ email, role }, process.env.ACCESS_TOKEN);
          
              // Return the token and user details
              res.status(201).json({ token, email, name, role,photo,clientCompany,clientPosition,clientCountry,agreeWithTermsConditions });
            } catch (error) {
              console.error('Registration error:', error);
              res.status(500).json({ message: 'Failed to register' });
            }
          });
          
          // User login
          app.post('/user/login', async (req, res) => {
            const { email, password } = req.body;
          
            try {
              // Check if the user exists
              const user = await usersCollection.findOne({ email });
              if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
              }
          
              // Compare the password
              const isPasswordValid = await bcrypt.compare(password, user.password);
              if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
              }
          
              // Generate a JWT token
              const token = jwt.sign({ email, role: user.role }, process.env.ACCESS_TOKEN);
          
              // Return the token and user details
              res.status(200).json({ token, email, name: user.name, role: user.role, photo: user.photo, clientCompany, clientPosition, clientCountry });
            } catch (error) {
              console.error('Login error:', error);
              res.status(500).json({ message: 'Failed to login' });
            }
          });
          
          // Get user details
          app.get('/user', verifyToken, async (req, res) => {
            const { email } = req.user;
          
            try {
              // Fetch the user details
              const user = await usersCollection.findOne({ email });
              if (!user) {
                return res.status(404).json({ message: 'User not found' });
              }
          
              // Return the user details
              res.status(200).json({ email: user.email, name: user.name, role: user.role, photo: user.photo, phone:user.phone, clientCompany:user.clientCompany, clientPosition: user.clientPosition, clientCountry: user.clientCountry, agreeWithTermsConditions: user.agreeWithTermsConditions });
            } catch (error) {
              console.error('User details error:', error);
              res.status(500).json({ message: 'Failed to fetch user details' });
            }
          });
        
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