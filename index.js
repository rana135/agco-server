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


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rtycqvb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



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
        const ProductCollection = client.db("ecommerceDatabase").collection("products");
        const OrderCollection = client.db("ecommerceDatabase").collection("orders");
        const CardCollection = client.db("ecommerceDatabase").collection("cart");

        const paymentCollection = client.db("ecommerceDatabase").collection("payments");


        // get all Products or data load:-
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = ProductCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        })
        // get single Product(purchage):-
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await ProductCollection.findOne(query)
            res.send(result)
        })

        // OrderItem:-
        app.get('/allOrder', async (req, res) => {
            const query = {};
            const cursor = paymentCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders)
        })

        // addtocart:-
        // GET request to fetch cart items
        app.get('/api/cart', async (req, res) => {
            const email = req?.query?.email;
            const query = { email: email };
            const cartItems = await CardCollection.find(query).toArray();
            res.send(cartItems);
        })           

        // POST request to add an item to the cart
        app.post('/api/cart/add', async (req, res) => {
            const product = req.body;

            try {
                const result = await CardCollection.insertOne(product);
                res.status(201).json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // PUT request to update quantity of an existing cart item
        app.put('/api/cart/update/:id', async (req, res) => {
            const { id } = req.params;
            console.log(id);
            const { quantity, selectedColor, selectedSize } = req.body;

            try {
                const result = await CardCollection.updateOne(
                    { _id: ObjectId(id) },
                    {
                        $set: {
                            quantity,
                            selectedColor,
                            selectedSize,
                        },
                    },
                    { upsert: true }
                );
                res.status(200).json({ message: 'Product quantity and details updated' });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // increase/decrease:
        app.put('/cart/update/:id', async (req, res) => {
            const { id } = req.params;
            const { quantity } = req.body;

            try {
                const result = await CardCollection.updateOne(
                    { _id: ObjectId(id) },
                    {
                        $set: {
                            quantity
                        },
                    },
                    { upsert: true }
                );
                res.status(200).json({ message: 'Quantity updated' });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/cart/remove/:id', async (req, res) => {
            const productId = req.params.id;

            try {
                const result = await CardCollection.deleteOne({ _id: ObjectId(productId) });
                res.status(200).json({ message: 'Item removed from cart' });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Payment:-
        app.post("/create-payment-intent", async (req, res) => {
            const service = req.body;
            const price = service.price === 0 ? 1 : service.price;
            const amount = price * 100;
            console.log(amount);
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

        app.patch('/updatedCart', async (req, res) => {
            try {
                let payments = req.body;

                // Ensure payments is an array even for a single payment
                if (!Array.isArray(payments)) {
                    payments = [payments];
                }

                console.log(payments);

                const updateOperations = payments.map(async (payment) => {
                    const filter = { _id: ObjectId(payment.payment) };
                    const updateDoc = {
                        $set: {
                            paid: true,
                            transactionId: payment.transactionId,
                        }
                    };
                    await CardCollection.updateOne(filter, updateDoc);
                });

                await Promise.all(updateOperations);

                const result = await paymentCollection.insertMany(payments);
                res.status(200).json({ success: true, result });
            } catch (error) {
                console.error('Error updating carts:', error);
                res.status(500).json({ success: false, error: 'Error updating carts' });
            }
        });
        // Adding item to wishlist for a user
        const addUserWishlistItem = async (userId, productId) => {
            const user = await db.collection('users').findOne({ _id: userId });
            if (user) {
                await db.collection('users').updateOne(
                    { _id: userId },
                    { $addToSet: { wishlist: productId } }
                );
            }
        };
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Ecommerce Server!')
})

app.listen(port, () => {
    console.log(`Ecommerce Server listening on port ${port}`)
})