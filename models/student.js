
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        contact: {
            type: String,
            required: true,
            trim: true
        },

        course: {
            type: String,
            default: ""
        },

        admissionDate: {
            type: Date,
            default: null
        },

        passingDate: {
            type: Date,
            default: null
        },

        feesPaid: {
            type: Number,
            required: true,
            default: 0
        },

        feesRemaining: {
            type: Number,
            required: true,
            default: 0
        },

        photoUrl: {
            type: String,
            default: ""
        },

        certificateUrl: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Student", studentSchema);
