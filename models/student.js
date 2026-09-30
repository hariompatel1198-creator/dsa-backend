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

        feesPaid: {
            type: Number,
            required: true,
            default: 0
        },

        feesRemaining: {
            type: Number,
            required: true,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Student", studentSchema);
