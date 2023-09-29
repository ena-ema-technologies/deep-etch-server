const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const multer = require('multer');
const Dropbox = require('dropbox').Dropbox;
const fetch = require('isomorphic-fetch');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { log } = require('console');
const { default: axios } = require('axios');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.hc5ickt.mongodb.net/?retryWrites=true&w=majority`;


app.use(cors());
app.use(express.json());

// let clientId = process.env.DROPBOX_CLIENT_ID;
// let clientSecret = process.env.DROPBOX_CLIENT_SECRET;
let accessToken = process.env.DROPBOX_ACCESS_TOKEN;
// let accessTokenExpirationTime = null;

const upload = multer({ dest: 'uploads/' });

// Replace these with your Dropbox API credentials
const dropbox = new Dropbox({
  accessToken: accessToken,
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
});


// // Function to refresh the Dropbox access token
// async function refreshAccessToken() {
//   try {
//     const response = await axios.post('https://api.dropboxapi.com/oauth2/token', null, {
//       params: {
//         grant_type: 'refresh_token',
//         refresh_token: process.env.DROPBOX_ACCESS_TOKEN, // You need to store and use the refresh token from the initial OAuth flow
//       },
//       auth: {
//         username: clientId,
//         password: clientSecret,
//       },
//     });

//     if (response.status === 200) {
//       const newAccessToken = response.data.access_token;
//       console.log('New access token obtained:', newAccessToken);
//       // Update the DROPBOX_ACCESS_TOKEN variable with the new access token
//       accessToken = newAccessToken;
//       // Update the Dropbox SDK instance with the new access token
//       dropbox.setAccessToken(newAccessToken);
//     } else {
//       console.error('Error refreshing access token:', response.statusText);
//     }
//   } catch (error) {
//     console.error('Error refreshing access token:', error.message);
//   }
// }


async function createSharedLink(filePath) {
  try {
    const response = await dropbox.sharingCreateSharedLinkWithSettings({ path: filePath });
    return response.result.url;
  } catch (error) {
    console.error('Error creating shared link:', error);
    throw error;
  }
}

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
  const usersCollection = client.db("deepEtch").collection("users");
  const quoteCollection = client.db("deepEtch").collection("customerRequest");
  const servicePricing = client.db("deepEtch").collection("servicePricing");
  const trialRequestCollection = client.db("deepEtch").collection("trialRequest");
  const notificationCollection = client.db("deepEtch").collection("notification");
  try {


    //Verify Admin

    const verifyAdmin = async (req, res, next) => {
      const { email } = req.user;
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      if (result?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Forbidden access" })
      }
      next()
    }

    //Verify Manager

    const verifyManager = async (req, res, next) => {
      const { email } = req.user;
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      if (result?.role !== "manager") {
        return res.status(403).send({ error: true, message: "Forbidden access" })
      }
      next()
    }

    // Verify Common
    // const verifyCommon = async (req, res, next) => {
    //   const { email } = req.user;
    //   const query = { email: email }
    //   const result = await usersCollection.findOne(query)
    //   if (result?.role !== "admin" || result?.role !== "manager") {
    //     return res.status(403).send({ error: true, message: "Forbidden access" })
    //   }
    //   next()
    // }

    app.get("/all-service", async (req, res) => {
      const result = await serviceCollection.find({}).toArray();
      res.send(result)
    })


    // Testimonial APIs
    app.get("/client-testimonial", async (req, res) => {
      const result = await testimonialCollection.find({}).toArray();
      res.send(result)
    })

    app.post("/new-client-testimonial", verifyToken, async (req, res) => {
      const newTestimonial = req.body;
      const result = await testimonialCollection.insertOne(newTestimonial);
      res.send(result)
    })

    app.patch("/new-testimonial-update/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const existsReview = await testimonialCollection.findOne(filter);
      if (existsReview) {
        const newData = req.body;
        const updateDoc = {
          $set: {
            status: newData.status
          }
        }
        const result = await testimonialCollection.updateOne(filter, updateDoc);
        return res.send(result)
      }
    })

    app.delete("/delete-testimonial/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await testimonialCollection.deleteOne(filter);
      res.send(result)

    })



    app.post('/user/sigUp', async (req, res) => {
      const { name, role, phone, email, password, photo, clientPosition, clientCompany, clientCountry, agreeWithTermsConditions } = req.body;

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
        res.status(201).json({ token, email, name, role, photo, clientCompany, clientPosition, clientCountry, agreeWithTermsConditions });
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
        res.status(200).json({ token, email, name: user.name, role: user.role, photo: user.photo, clientCompany: user.clientCompany, clientPosition: user.clientPosition, clientCountry: user.clientCountry });
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
          return res.json({ user: false });
        }

        // Return the user details
        res.status(200).json({ email: user.email, name: user.name, role: user.role, photo: user.photo, phone: user.phone, clientCompany: user.clientCompany, clientPosition: user.clientPosition, clientCountry: user.clientCountry, agreeWithTermsConditions: user.agreeWithTermsConditions });
      } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ message: 'Failed to fetch user details' });
      }
    });

    // user delete
    app.delete("/delete-user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result)
    })

    // Store user quote request

    app.post("/get-quote-request", verifyToken, async (req, res) => {
      const newRequest = req.body;
      const result = await quoteCollection.insertOne(newRequest);
      res.send(result);
    })

    // Trial APIS
    app.post("/free-trial-request", verifyToken, async (req, res) => {
      const newRequest = req.body;
      const email = newRequest.email;
      const query = { email: email };
      const existsReq = await trialRequestCollection.findOne(query);
      if (existsReq) {
        res.json({ message: 'Your free trial quota has been finished! You can try our premium package.' })
      } else {
        const result = await trialRequestCollection.insertOne(newRequest);
        res.send(result);
      }

    })


    app.patch("/update-trials-results/:id", verifyToken, verifyManager, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const existsReq = await trialRequestCollection.findOne(filter);
      if (existsReq) {
        const existsResult = existsReq?.result || [];
        const newResult = req.body;
        const updateResult = {
          $set: {
            result: [...existsResult, newResult],
            status: "Complete"
          }
        }
        const result = await trialRequestCollection.updateOne(filter, updateResult);
        return res.send(result);
      }
      else {
        return res.json({ message: "Failed to update" })
      }
    })


    // Upload photos in Dropbox and send links
    app.post('/upload', upload.array('photos', 10), async (req, res) => {
      // if (!accessTokenExpirationTime || Date.now() >= accessTokenExpirationTime) {
      //   await refreshAccessToken();
      // }else{
      //   try {
      //     const uploadedFiles = req.files;
      //     const sharedLinks = [];

      //     for (let i = 0; i < uploadedFiles.length; i++) {
      //       const file = uploadedFiles[i];
      //       const fileContent = require('fs').readFileSync(file.path);
      //       const response = await dropbox.filesUpload({ path: `/photos/${file.originalname}`, contents: fileContent });

      //       const sharedLink = await createSharedLink(response.result.path_display);
      //       sharedLinks.push(sharedLink);

      //       // Clean up: Delete the temporary file on the server
      //       require('fs').unlinkSync(file.path);
      //     }

      //     // Send the shared links as the response
      //     res.status(200).json({ links: sharedLinks });
      //   } catch (error) {
      //     console.error(error);
      //     res.status(500).send('Error uploading photos to Dropbox');
      //   }
      // }

      try {
        const uploadedFiles = req.files;
        const sharedLinks = [];

        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const fileContent = require('fs').readFileSync(file.path);
          const response = await dropbox.filesUpload({ path: `/photos/${file.originalname}`, contents: fileContent });

          const sharedLink = await createSharedLink(response.result.path_display);
          sharedLinks.push(sharedLink);

          // Clean up: Delete the temporary file on the server
          require('fs').unlinkSync(file.path);
        }

        // Send the shared links as the response
        res.status(200).json({ links: sharedLinks });
      } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading photos to Dropbox');
      }

    });


    app.get("/service-pricing", async (req, res) => {
      const result = await servicePricing.find({}).toArray();
      res.send(result)
    })


    // Admin Api

    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const newRole = req.body;
      const userUpdate = {
        $set: {
          role: newRole.role
        }
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result);
    })

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { admin: user?.role === "admin" }
      res.send(result);
    })

    app.get("/all-users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    })

    // Managers APIs
    app.patch("/users/manager/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const newRole = req.body;
      const userUpdate = {
        $set: {
          role: newRole.role
        }
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result);
    })

    app.get("/users/manager/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { manager: user?.role === "manager" }
      res.send(result);
    })

    // Get orders

    app.get("/user-orders", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      if (email) {
        const result = await quoteCollection.find(filter).toArray();
        return res.send(result)
      } else {
        return res.send([])
      }
    })

    app.get("/all-user-orders", verifyToken, verifyAdmin, async (req, res) => {

      const result = await quoteCollection.find({}).toArray();
      return res.send(result)

    })

    app.patch("/orders-update-status/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const existsReq = await quoteCollection.findOne(filter);
      if (existsReq) {
        const newResult = req.body;
        const updateResult = {
          $set: {
            status: newResult.status
          }
        }
        const result = await quoteCollection.updateOne(filter, updateResult);
        return res.send(result);
      }
      else {
        return res.json({ message: "Failed to update" })
      }
    })

    app.patch("/payment-update-status/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const existsReq = await quoteCollection.findOne(filter);
      if (existsReq) {
        const newData = req.body;
        const updateResult = {
          $set: {
            payment: newData.payment
          }
        }
        const result = await quoteCollection.updateOne(filter, updateResult);
        return res.send(result);
      }
      else {
        return res.json({ message: "Failed to update" })
      }
    })


    // Get trials
    app.get("/user-trial-request", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      if (email) {
        const result = await trialRequestCollection.find(filter).toArray();
        return res.send(result)
      } else {
        return res.send([])
      }
    })

    // Get all trials
    app.get("/all-user-trial-request", verifyToken, verifyManager, async (req, res) => {
      const result = await trialRequestCollection.find({}).toArray();
      return res.send(result);
    })

    // Notification
    app.patch("/update/notification/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const newNotification = req.body;
      const filter = { clientEmail: email };
      const existsUser = await notificationCollection.findOne(filter);
      if (existsUser) {
        const existsResult = existsUser?.notification;
        const updateNotification = {
          message: newNotification.message,
          date: newNotification.date,
          id: existsResult.length + 1,
          status: newNotification.status
        }
        const updateResult = {
          $set: {
            notification: [...existsResult, updateNotification],
            status: "Unread"
          }
        }
        const result = await notificationCollection.updateOne(filter, updateResult);
        return res.send(result);
      }else{
        const newResult = {
          clientEmail: email,
          notification: [newNotification],
          status: "Unread"
        }
        const result = await notificationCollection.insertOne(newResult);
        return res.send(result)
      }
    })

    app.get("/user-notification", verifyToken,async(req,res)=>{
      const email = req.query.email;
      const filter = {clientEmail: email};
      const result = await notificationCollection.find(filter).toArray();
      if(result){
        return res.send(result);
      }else{
        return res.send([])
      }
    })
    
    app.patch("/notification/mark/read/:email",async(req,res)=>{
      // const id = req.params.id;
      const email = req.params.email;
      const filter = {clientEmail: email};
      const newBody = req.body;
      const existsUser = await notificationCollection.findOne(filter);
      if(existsUser){
          const updateDoc = {
            $set:{
              status: newBody.status
            }
          }
          const result = await notificationCollection.updateOne(filter,updateDoc);
          res.send(result)

      }
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