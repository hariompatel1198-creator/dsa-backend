const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Owner = require("./models/owner");
const Student = require("./models/student");

const app = express();

app.use(cors());
app.use(express.json());


// ===============================
// MONGODB CONNECTION
// ===============================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.log("MongoDB connection failed");
        console.log(error.message);
    });


// ===============================
// TEST ROUTE
// ===============================

app.get("/", (req, res) => {
    res.send("Digital Skill Academy Backend Running");
});


// ===============================
// CREATE OWNER
// ===============================

app.post("/api/create-owner", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                message: "Username and password required"
            });

        }

        const existingOwner =
            await Owner.findOne({ username });

        if (existingOwner) {

            return res.status(400).json({
                message: "Owner already exists"
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const owner = new Owner({
            username,
            password: hashedPassword
        });

        await owner.save();

        res.status(201).json({
            message: "Owner account created successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// ===============================
// OWNER LOGIN
// ===============================

app.post("/api/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const owner =
            await Owner.findOne({ username });

        if (!owner) {

            return res.status(401).json({
                message: "Invalid username or password"
            });

        }

        const passwordMatch =
            await bcrypt.compare(
                password,
                owner.password
            );

        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid username or password"
            });

        }

        res.json({
            message: "Login successful",
            success: true
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// ===============================
// ADD STUDENT
// ===============================

app.post("/api/students", async (req, res) => {

    try {

        const {
            name,
            contact,
            feesPaid,
            feesRemaining
        } = req.body;

        if (!name || !contact) {

            return res.status(400).json({
                message: "Student name and contact are required"
            });

        }

        const student = new Student({

            name,
            contact,

            feesPaid:
                Number(feesPaid) || 0,

            feesRemaining:
                Number(feesRemaining) || 0

        });

        await student.save();

        res.status(201).json({

            message: "Student added successfully",

            student

        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Student add failed"
        });

    }

});


// ===============================
// GET ALL STUDENTS
// ===============================

app.get("/api/students", async (req, res) => {

    try {

        const students =
            await Student.find()
                .sort({
                    createdAt: -1
                });

        res.json(students);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Students fetch failed"
        });

    }

});


// ===============================
// UPDATE STUDENT
// ===============================

app.put("/api/students/:id", async (req, res) => {

    try {

        const {
            name,
            contact,
            feesPaid,
            feesRemaining
        } = req.body;

        if (!name || !contact) {

            return res.status(400).json({
                message: "Student name and contact are required"
            });

        }

        const student =
            await Student.findByIdAndUpdate(

                req.params.id,

                {
                    name,
                    contact,
                    feesPaid:
                        Number(feesPaid) || 0,
                    feesRemaining:
                        Number(feesRemaining) || 0
                },

                {
                    new: true,
                    runValidators: true
                }

            );

        if (!student) {

            return res.status(404).json({
                message: "Student not found"
            });

        }

        res.json({

            message:
                "Student updated successfully",

            student

        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Student update failed"
        });

    }

});


// ===============================
// DELETE STUDENT
// ===============================

app.delete("/api/students/:id", async (req, res) => {

    try {

        const student =
            await Student.findByIdAndDelete(
                req.params.id
            );

        if (!student) {

            return res.status(404).json({
                message: "Student not found"
            });

        }

        res.json({
            message: "Student deleted successfully"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Student delete failed"
        });

    }

});


// ===============================
// SERVER
// ===============================

const PORT =
    process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});