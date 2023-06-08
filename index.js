const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vweq3se.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const usersCollection = client.db("mindfulnessDB").collection("users");
        const instractorsCollection = client.db("mindfulnessDB").collection("instractors");
        const classesCollection = client.db("mindfulnessDB").collection("classes");
        // Connect the client to the server	(optional starting in v4.7)


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // users related apis
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        // instractors  apis
        app.get('/instractors', async (req, res) => {
            const result = await instractorsCollection.find().toArray();
            res.send(result);
        })

        app.get('/top-instractors', async (req, res) => {
            const limit = req.query.limit ? parseInt(req.query.limit) : 6;
            const result = await instractorsCollection.find().limit(limit).toArray();
            res.send(result);
        });

        app.post('/instractors', verifyJWT, async (req, res) => {
            const newInstractor = req.body;
            const result = await instractorsCollection.insertOne(newInstractor)
            res.send(result);
        })

        app.delete('/instractors/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await instractorsCollection.deleteOne(query);
            res.send(result);
        })

        // admin api
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            // console.log('admin');
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
                console.log('!admin')
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // classes  apis
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.get('/top-classes', async (req, res) => {
            const limit = req.query.limit ? parseInt(req.query.limit) : 6;
            const result = await classesCollection.find().limit(limit).toArray();
            res.send(result);
        });


        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Mindfulness server is running")
})

app.listen(port, () => {
    console.log(`Mindfulness server is running on port ${port}`)
})