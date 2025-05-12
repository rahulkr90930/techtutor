const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { engine } = require('express-handlebars');
const session = require('express-session');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.engine('hbs', engine({ extname: 'hbs', defaultLayout: 'main', layoutsDir: 'views/layouts', partialsDir: 'views/partials' }));
app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'rahulkota207', // Replace with your secret key
    resave: false,
    saveUninitialized: true,
}));

// Models
const Student = require('./models/Student'); // Import Student model
const Teacher = require('./models/Teacher'); // Import Teacher model

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email service
    auth: {
        user: process.env.EMAIL, // Your email address
        pass: process.env.EMAIL_PASSWORD, // Your email password or app password
    },
});

// Routes
app.get('/', (req, res) => {
    res.render('home', { title: 'Home' }); // Home page rendering
});

// Student Signup Page
app.get('/student-signup', (req, res) => {
    res.render('student-signup', { title: 'Student Signup' });
});

// Teacher Signup Page
app.get('/teacher-signup', (req, res) => {
    res.render('teacher-signup', { title: 'Teacher Signup' });
});

// Student Signup Logic
app.post('/student-signup', async (req, res) => {
    try {
        // Check if passwords match
        if (req.body.password !== req.body.confirmPassword) {
            return res.status(400).send("Passwords do not match. Please try again.");
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const newStudent = new Student({
            email: req.body.email,
            password: hashedPassword,
            phone: req.body.phone,
            address: req.body.address,
            class: req.body.class,
        });

        await newStudent.save();

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        req.session.otp = otp; // Store OTP in session
        req.session.userId = newStudent._id; // Store student ID in session

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL,
            to: req.body.email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send("Error sending OTP. Please try again.");
            }
            console.log('Email sent: ' + info.response);
            res.redirect('/verify-otp'); // Redirect to OTP verification page
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error signing up. Please try again.");
    }
});

// Teacher Signup Logic
app.post('/teacher-signup', async (req, res) => {
    try {
        // Check if passwords match
        if (req.body.password !== req.body.confirmPassword) {
            return res.status(400).send("Passwords do not match. Please try again.");
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const newTeacher = new Teacher({
            email: req.body.email,
            password: hashedPassword,
            phone: req.body.phone,
            address: req.body.address,
            subjects: req.body.subjects.split(','), // Assuming subjects are sent as a comma-separated string
        });

        await newTeacher.save();

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
        req.session.otp = otp; // Store OTP in session
        req.session.userId = newTeacher._id; // Store teacher ID in session

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL,
            to: req.body.email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send("Error sending OTP. Please try again.");
            }
            console.log('Email sent: ' + info.response);
            res.redirect('/verify-otp'); // Redirect to OTP verification page
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error signing up. Please try again.");
    }
});

// OTP Verification Page
app.get('/verify-otp', (req, res) => {
    res.render('otp-verification', { title: 'Verify OTP' }); // Render OTP verification page
});

// OTP Verification Logic
app.post('/verify-otp', async (req, res) => {
    if (req.body.otp == req.session.otp) {
        // OTP is correct
        const userId = req.session.userId; // Retrieve user ID from session
        delete req.session.otp; // Clear the OTP from session

        // Check if userId corresponds to a student or teacher
        const student = await Student.findById(userId);
        const teacher = await Teacher.findById(userId);
        
        if (student) {
            req.session.userId = student._id; // Set session user ID for student
            res.redirect('/student-dashboard'); // Redirect to student dashboard
        } else if (teacher) {
            req.session.userId = teacher._id; // Set session user ID for teacher
            res.redirect('/teacher-dashboard'); // Redirect to teacher dashboard
        } else {
            res.status(404).send("User not found. Please try again.");
        }
    } else {
        res.status(400).send("Invalid OTP. Please try again.");
    }
});

// Student Login Page
app.get('/student-login', (req, res) => {
    res.render('student-login', { title: 'Student Login' });
});

// Teacher Login Page
app.get('/teacher-login', (req, res) => {
    res.render('teacher-login', { title: 'Teacher Login' });
});

// Student Login Route
app.post('/student-login', async (req, res) => {
    try {
        const student = await Student.findOne({ email: req.body.email });

        if (!student) {
            return res.status(400).send("User not found. Please sign up.");
        }

        const isMatch = await bcrypt.compare(req.body.password, student.password);

        if (!isMatch) {
            return res.status(400).send("Incorrect password.");
        }

        // Set session
        req.session.userId = student._id; // Store student ID in session
        console.log('Student logged in:', student); // Debugging log
        res.redirect('/student-dashboard'); // Redirect to student dashboard after successful login
    } catch (err) {
        console.error(err);
        res.status(500).send("Error logging in. Please try again.");
    }
});

// Teacher Login Route
app.post('/teacher-login', async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ email: req.body.email });

        if (!teacher) {
            return res.status(400).send("User not found. Please sign up.");
        }

        const isMatch = await bcrypt.compare(req.body.password, teacher.password);

        if (!isMatch) {
            return res.status(400).send("Incorrect password.");
        }

        // Set session
        req.session.userId = teacher._id; // Store teacher ID in session
        console.log('Teacher logged in:', teacher); // Debugging log
        res.redirect('/teacher-dashboard'); // Redirect to teacher dashboard after successful login
    } catch (err) {
        console.error('Teacher login error:', err);
        res.status(500).send("Error logging in. Please try again.");
    }
});

// Student Dashboard Route
app.get('/student-dashboard', (req, res) => {
    if (!req.session.userId) {
        console.log('Student not logged in, redirecting to login.'); // Debugging log
        return res.redirect('/student-login'); // Redirect to login if not logged in
    }

    res.render('student-dashboard', { title: 'Student Dashboard' });
});

// Teacher Dashboard Route
app.get('/teacher-dashboard', (req, res) => {
    if (!req.session.userId) {
        console.log('Teacher not logged in, redirecting to login.'); // Debugging log
        return res.redirect('/teacher-login'); // Redirect to login if not logged in
    }

    res.render('teacher-dashboard', { title: 'Teacher Dashboard' });
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send("Error logging out. Please try again.");
        }
        res.redirect('/'); // Redirect to home page after logout
    });
});

// Starting the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`); // Server running message
});
