const express = require('express')
const cors = require('cors');
var jwt = require('jsonwebtoken');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// middleWare:-
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.to6z5.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // console.log("Beared with token:- ", authHeader);
    if (!authHeader) {
        res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        client.connect();
        const ProductCollection = client.db("agcoDatabase").collection("products");
        const ReviewCollection = client.db("agcoDatabase").collection("reviews");
        const OrderCollection = client.db("agcoDatabase").collection("orders");
        const userCollection = client.db("agcoDatabase").collection("users");
        const profileCollection = client.db("agcoDatabase").collection("profile");
        const paymentCollection = client.db("agcoDatabase").collection("payments");


        // get all Products or data load:-
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = ProductCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        })
        // delete products
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await ProductCollection.deleteOne(query)
            res.send(result)
        })
        // post database
        app.post('/products', async (req, res) => {
            const newService = req.body
            const result = await ProductCollection.insertOne(newService)
            res.send(result)
        })
        // get single Product(purchage):-
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await ProductCollection.findOne(query)
            res.send(result)
        })
        // get all reviews:-
        app.get('/reviews', async (req, res) => {
            const query = {}
            const cursor = ReviewCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })
        // post  review:-
        app.post('/reviews', async (req, res) => {
            const newReviews = req.body
            const result = await ReviewCollection.insertOne(newReviews)
            res.send(result)
        })
        app.post('/orders', async (req, res) => {
            const order = req.body
            const result = await OrderCollection.insertOne(order)
            res.send(result)
        })
        // get order item:-
        app.get('/orders', verifyJWT, async (req, res) => {
            const decodedEmail = req?.decoded?.email;
            const email = req?.query?.email;
            if (email == decodedEmail) {
                const query = { email: email };
                const bookings = await OrderCollection.find(query).toArray();
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: "forbiden access" })
            }
        })
        // get single Order for payment:-
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await OrderCollection.findOne(query);
            res.send(order);
        })
        // delete order item:-
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await OrderCollection.deleteOne(query)
            res.send(result)
        })
        // 
        app.patch('/orders/:id', verifyJWT, async (req, res) => {
            const id = req?.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid:true,
                    transactionId:payment.transactionId,
                }
            }
            const updatedOrder = await OrderCollection.updateOne(filter, updateDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updateDoc);
        })
        // insert user (login/register) information:-
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, option)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
            res.send({ result, token: token });
        })
        // get all users:-
        app.get('/user', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });
        // Making Admin:-
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === "admin") {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                }
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                return res.status(403).send({ message: "forbiden access" })
            }
        })
        // check user role in database/given power as Admin:-
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user?.role === 'admin';
            res.send({ admin: isAdmin });
        })
        // update profile post database:-
        app.put('/updateProfile/:email', verifyJWT, async (req, res) => {
            const email = req?.params.email;
            const profile = req.body;
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: profile,
            }
            const result = await profileCollection.updateOne(filter, updateDoc, option)
            res.send(result)
        })
        // get email base profile:-
        app.get('/profile', verifyJWT, async (req, res) => {
            const decodedEmail = req?.decoded?.email;
            const email = req?.query?.email;
            if (email == decodedEmail) {
                const query = { email: email };
                const profile = await profileCollection.find(query).toArray();
                res.send(profile);
            }
            else {
                return res.status(403).send({ message: "forbiden access" })
            }
        });
        app.delete("/deleteUser/:id", async (req, res) => {
            const id = req?.params.id
            const query = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        // Payment:-
        app.post("/create-payment-intent",verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('AGCO Server!')
})

app.listen(port, () => {
    console.log(`AGCO Server listening on port ${port}`)
})