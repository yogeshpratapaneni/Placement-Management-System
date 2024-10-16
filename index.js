require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Express session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Use .env variable or fallback
    resave: false,
    saveUninitialized: true,
}));

// MySQL database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '2004',
    database: process.env.DB_NAME || 'placement_management'
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL connected...');
});

// Route: Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html')); // Serve homepage.html
});

// Route: Sign Up
app.post('/signup', (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, hashedPassword, role], (err, result) => {
        if (err) throw err;
        res.redirect('/login');
    });
});

// Route: Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, result) => {
        if (err) throw err;

        if (result.length === 0) {
            return res.send('User not found');
        }

        const user = result[0];

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, email: user.email, role: user.role };
            res.redirect(user.role === 'student' ? '/student-dashboard' : '/recruiter-dashboard');
        } else {
            res.send('Incorrect password');
        }
    });
});

// Route: Student Dashboard
app.get('/student-dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.redirect('/login');
    }

    // Fetch student's applied jobs, etc.
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

// Route: Recruiter Dashboard
app.get('/recruiter-dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'recruiter') {
        return res.redirect('/login');
    }

    // Fetch jobs posted by the recruiter, etc.
    res.sendFile(path.join(__dirname, 'public', 'recruiter-dashboard.html'));
});

// Route: Add Job (Recruiter)
app.post('/add-job', (req, res) => {
    const { title, description, salary, location } = req.body;
    const recruiterId = req.session.user.id;

    const sql = 'INSERT INTO jobs (title, description, salary, location, recruiter_id) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [title, description, salary, location, recruiterId], (err, result) => {
        if (err) throw err;
        res.redirect('/recruiter-dashboard');
    });
});

// Route: View Job Listings (for students)
app.get('/jobs-available', (req, res) => {
    const sql = 'SELECT * FROM jobs';
    db.query(sql, (err, result) => {
        if (err) throw err;
        res.json(result);
    });
});

// Route: Apply for a Job (Student)
app.post('/apply-job', (req, res) => {
    const jobId = req.body.jobId;
    const studentId = req.session.user.id;

    const sql = 'INSERT INTO applications (job_id, student_id) VALUES (?, ?)';
    db.query(sql, [jobId, studentId], (err, result) => {
        if (err) throw err;
        res.redirect('/student-dashboard');
    });
});

// Route: View Applicants (Recruiter)
app.get('/view-applicants/:jobId', (req, res) => {
    const jobId = req.params.jobId;

    const sql = `
        SELECT users.name, users.email 
        FROM applications 
        JOIN users ON applications.student_id = users.id 
        WHERE applications.job_id = ?
    `;
    db.query(sql, [jobId], (err, result) => {
        if (err) throw err;
        res.json(result);
    });
});

// Route: Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// 404 Error Page
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
