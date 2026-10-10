
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
require("dotenv").config();

const Owner = require("./models/owner");
const Student = require("./models/student");
const File = require("./models/file");

const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================
// MONGODB CONNECTION
// =====================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected successfully"))
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });

// =====================================
// FILE UPLOAD CONFIGURATION
// =====================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith("image/");
        const isPdf = file.mimetype === "application/pdf";

        if (file.fieldname === "photo" && isImage) {
            return cb(null, true);
        }

        if (
            file.fieldname === "certificate" &&
            (isImage || isPdf)
        ) {
            return cb(null, true);
        }

        return cb(
            new Error(
                "Photo must be an image. Certificate must be an image or PDF."
            )
        );
    }
});

const uploadFields = upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "certificate", maxCount: 1 }
]);

// =====================================
// HELPER FUNCTIONS
// =====================================

function parseDate(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === "") {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date.");
    }

    return date;
}

function getFileUrl(req, fileId) {
    return `${req.protocol}://${req.get("host")}/api/files/${fileId}`;
}

async function saveFileToMongoDB(file) {
    if (!file) {
        return null;
    }

    return File.create({
        originalName: file.originalname,
        contentType: file.mimetype,
        data: file.buffer
    });
}

function getValidFees(value, fieldName) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Invalid ${fieldName}.`);
    }

    return amount;
}

// =====================================
// TEST ROUTE
// =====================================

app.get("/", (req, res) => {
    res.send("Digital Skill Academy Backend Running");
});

// =====================================
// VIEW / DOWNLOAD PHOTO OR CERTIFICATE
// =====================================

app.get("/api/files/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid file ID");
        }

        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).send("File not found");
        }

        const download = req.query.download === "true";
        const safeName = file.originalName.replace(/["\r\n]/g, "_");

        res.set("Content-Type", file.contentType);
        res.set(
            "Content-Disposition",
            `${download ? "attachment" : "inline"}; filename="${safeName}"`
        );
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Cache-Control", "private, no-store");

        return res.send(file.data);
    } catch (error) {
        console.error("FILE FETCH ERROR:", error);
        return res.status(500).send("Could not fetch file");
    }
});

// =====================================
// CREATE OWNER
// =====================================

app.post("/api/create-owner", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password required"
            });
        }

        const existingOwner = await Owner.findOne({ username });

        if (existingOwner) {
            return res.status(400).json({
                message: "Owner already exists"
            });
        }

        const owner = new Owner({
            username,
            password: await bcrypt.hash(password, 10)
        });

        await owner.save();

        return res.status(201).json({
            message: "Owner account created successfully"
        });
    } catch (error) {
        console.error("CREATE OWNER ERROR:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
});

// =====================================
// OWNER LOGIN
// =====================================

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const owner = await Owner.findOne({ username });

        if (
            !owner ||
            !(await bcrypt.compare(password || "", owner.password))
        ) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        return res.json({
            message: "Login successful",
            success: true
        });
    } catch (error) {
        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
});

// =====================================
// ADD STUDENT
// =====================================

app.post("/api/students", uploadFields, async (req, res) => {
    let savedPhoto = null;
    let savedCertificate = null;

    try {
        const {
            name,
            contact,
            course = "",
            feesPaid = 0,
            feesRemaining = 0,
            admissionDate = "",
            passingDate = ""
        } = req.body;

        if (!name?.trim() || !contact?.trim()) {
            return res.status(400).json({
                message: "Student name and contact are required"
            });
        }

        if (!/^\d{10}$/.test(contact.trim())) {
            return res.status(400).json({
                message: "Enter a valid 10-digit mobile number"
            });
        }

        const paid = getValidFees(feesPaid, "fees paid");
        const remaining = getValidFees(
            feesRemaining,
            "remaining fees"
        );

        const admission = parseDate(admissionDate);
        const passing = parseDate(passingDate);

        if (req.files?.photo?.[0]) {
            savedPhoto = await saveFileToMongoDB(
                req.files.photo[0]
            );
        }

        if (req.files?.certificate?.[0]) {
            savedCertificate = await saveFileToMongoDB(
                req.files.certificate[0]
            );
        }

        const student = new Student({
            name: name.trim(),
            contact: contact.trim(),
            course: course.trim(),
            feesPaid: paid,
            feesRemaining: remaining,
            admissionDate: admission,
            passingDate: passing,
            photoUrl: savedPhoto
                ? getFileUrl(req, savedPhoto._id)
                : "",
            certificateUrl: savedCertificate
                ? getFileUrl(req, savedCertificate._id)
                : ""
        });

        await student.save();

        return res.status(201).json({
            message: "Student added successfully",
            student
        });
    } catch (error) {
        console.error("ADD STUDENT ERROR:", error);

        // Clean up uploaded files if student creation fails.
        if (savedPhoto) {
            await File.findByIdAndDelete(savedPhoto._id).catch(() => {});
        }

        if (savedCertificate) {
            await File.findByIdAndDelete(
                savedCertificate._id
            ).catch(() => {});
        }

        return res.status(400).json({
            message: error.message || "Student add failed"
        });
    }
});

// =====================================
// GET ALL STUDENTS
// =====================================

app.get("/api/students", async (req, res) => {
    try {
        const students = await Student.find().sort({
            createdAt: -1
        });

        return res.json(students);
    } catch (error) {
        console.error("FETCH STUDENTS ERROR:", error);

        return res.status(500).json({
            message: "Students fetch failed"
        });
    }
});

// =====================================
// UPDATE STUDENT
// =====================================

app.put("/api/students/:id", uploadFields, async (req, res) => {
    let savedPhoto = null;
    let savedCertificate = null;

    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid student ID"
            });
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        const {
            name,
            contact,
            course,
            feesPaid,
            feesRemaining,
            admissionDate,
            passingDate
        } = req.body;

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Student name is required"
                });
            }

            student.name = name.trim();
        }

        if (contact !== undefined) {
            if (!/^\d{10}$/.test(contact.trim())) {
                return res.status(400).json({
                    message: "Enter a valid 10-digit mobile number"
                });
            }

            student.contact = contact.trim();
        }

        if (course !== undefined) {
            student.course = course.trim();
        }

        if (feesPaid !== undefined) {
            student.feesPaid = getValidFees(
                feesPaid,
                "fees paid"
            );
        }

        if (feesRemaining !== undefined) {
            student.feesRemaining = getValidFees(
                feesRemaining,
                "remaining fees"
            );
        }

        if (admissionDate !== undefined) {
            student.admissionDate = parseDate(admissionDate);
        }

        if (passingDate !== undefined) {
            student.passingDate = parseDate(passingDate);
        }

        // Keep old files unless a replacement is uploaded.
        if (req.files?.photo?.[0]) {
            savedPhoto = await saveFileToMongoDB(
                req.files.photo[0]
            );

            student.photoUrl = getFileUrl(req, savedPhoto._id);
        }

        if (req.files?.certificate?.[0]) {
            savedCertificate = await saveFileToMongoDB(
                req.files.certificate[0]
            );

            student.certificateUrl = getFileUrl(
                req,
                savedCertificate._id
            );
        }

        await student.save();

        return res.json({
            message: "Student updated successfully",
            student
        });
    } catch (error) {
        console.error("UPDATE STUDENT ERROR:", error);

        // Remove newly uploaded files if update fails.
        if (savedPhoto) {
            await File.findByIdAndDelete(savedPhoto._id).catch(() => {});
        }

        if (savedCertificate) {
            await File.findByIdAndDelete(
                savedCertificate._id
            ).catch(() => {});
        }

        return res.status(400).json({
            message: error.message || "Student update failed"
        });
    }
});

// =====================================
// DELETE STUDENT
// =====================================

app.delete("/api/students/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid student ID"
            });
        }

        const student = await Student.findByIdAndDelete(
            req.params.id
        );

        if (!student) {
            return res.status(404).json({
                message: "Student not found"
            });
        }

        // Files are intentionally retained.
        return res.json({
            message: "Student deleted successfully"
        });
    } catch (error) {
        console.error("DELETE STUDENT ERROR:", error);

        return res.status(500).json({
            message: "Student delete failed"
        });
    }
});

// =====================================
// ERROR HANDLER
// =====================================

app.use((error, req, res, next) => {
    console.error("REQUEST ERROR:", error);

    if (error instanceof multer.MulterError) {
        const message =
            error.code === "LIMIT_FILE_SIZE"
                ? "File is too large. Maximum size is 10 MB per file."
                : error.message;

        return res.status(400).json({ message });
    }

    return res.status(400).json({
        message: error.message || "Request failed"
    });
});

// =====================================
// START SERVER
// =====================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
