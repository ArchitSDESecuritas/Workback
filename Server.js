import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';

// Controllers & Routes
import { Login } from './Controller/Login.js';
import { MenuBar } from './Controller/Menu.js';
import { Register } from './Controller/Register.js';
import otpRoutes from './Routes/OtpRoutes.js';
import authRoutes from './Routes/AuthRoutes.js';
import { ContributorData } from './Controller/ContributorData.js';
import { ContributorEmpSearch } from './Controller/ContributorEmpSearch.js';
import { Orgmastermanage } from './Controller/Orgmastermanage.js';
import { OrgmasterData } from './Controller/OrgmasterData.js';
import { OrgmasterDelete } from './Controller/OrgmasterDelete.js';
import { OrgmasterNameUpdate } from './Controller/OrgmasterNameupdate.js';
import { OrgmasterSearch } from './Controller/OrgmasterSearch.js';
import { ContributorAdminData } from './Controller/ContributorAdminData.js';
import { ContributorUpdate } from './Controller/ContributorUpdate.js';
import { ContributorDelete } from './Controller/ContributorDelete.js';
import { createPaymentOrder, verifyPayment, reportPaymentFailure, getPaymentTransaction } from './Controller/Payment.js';
import { ClientDynamicfield } from './Controller/ClientDynamicfield.js';
import { ClientEmpData } from './Controller/ClientEmpData.js';
import { ReviewClientData } from './Controller/ReviewClientData.js';
import { updateClientDocuments } from './Controller/ClientDocumentUpdate.js';
import { ClientEmpStatus } from './Controller/ClientEmpStatus.js';
import { AdminClientData } from './Controller/AdminClientData.js';
import { UpdateClientStatus } from './Controller/UpdateClientStatus.js';
import { UpdateFinalReport } from './Controller/UpdateFinalReport.js';
import { DownloadUpdatePDF } from './Controller/DownloadUpdatePDF.js';
import { ContributorAdminFormDynamic } from './Controller/ContributorAdminFormDynamic.js';
import { ContributorEditData } from './Controller/ContributorEditData.js';
import { ContributorServiceRequest } from './Controller/ContributorServiceRequest.js';
import { ContributorDash } from './Controller/ContributorDash.js';
import { ContactUS } from './Controller/ContactUS.js';
import { PaymentAdminData } from './Controller/PaymentAdminData.js';
import { AdminDash } from './Controller/AdminDash.js';
import { AdminRequestProgress } from './Controller/AdminRequestProgress.js';
import { FacilitatorsData } from './Controller/Facilitatormasdata.js';
import { UpdateFacilitatorStatus } from './Controller/UpdateFacilitatorStatus.js';
import { FacilitatorsMapData } from './Controller/Facilitatormapdata.js';
import { MapFacilitatorToOrg } from './Controller/FacilitatorOrgmap.js';
import { DeleteFacilitatorOrgMap } from './Controller/DeleteFacilitaatororgmap.js';
import { CreateFacilitator } from './Controller/CreateFacilitator.js';
import { FacilitatorCommentsUpdate } from './Controller/FacilClientComUpdate.js';
import { OrgsByFacilitator } from './Controller/Fascilmaporg.js';
import { FascilatorComments } from './Controller/FascilComments.js';
import { FascilatorDashboard } from './Controller/FascilatorDashboard.js';
import { MasterManage } from './Controller/MasterUserData.js';
import { MasterUserUpdate } from './Controller/MasterUserUpdate.js';
import { PDFBase64 } from './Controller/PDFBase64.js';
import { ClientDownloadMail } from './Controller/ClientDownloadMail.js';
// Auth and Session Middleware
import { authenticateSession, authorizeRoles } from './Middleware/AuthMiddleware.js';

const PORT = Number(process.env.PORT) || 3001;

// Security middleware to check for the required API key in headers
const API_KEY = 'Securitas@#!1234';
function apiKeyMiddleware(req, res, next) {
    const key = req.header('APIKEY') || req.header('apikey');
    if (key && key === API_KEY) {
        return next();
    }
    return res.status(401).json({ message: 'Invalid or missing API Key' });
}

const app = express();

// Configure CORS
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'APIKEY', 'apikey', 'x-session-token'],
    exposedHeaders: ['x-refreshed-token', 'X-Refreshed-Token']
}));


// Allow two base64 documents up to 5 MB each plus the candidate payload.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Configure Express Session (10 minutes inactivity timeout)
app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'worktrail_session_secret_2026',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on every active request
    cookie: {
        httpOnly: true,
        secure: false, // set to true in production with HTTPS
        maxAge: 10 * 60 * 1000 // 10 minutes session limit
    }
}));

// Apply base security middleware to all routes under /api
app.use('/api', apiKeyMiddleware);

// Health check endpoint
app.get('/api', (req, res) => {
    res.json({
        status: 'online',
        service: 'Worktrail API & Session Server',
        sessionTimeoutMinutes: 10,
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// 1. PUBLIC AUTHENTICATION & RECOVERY ROUTES
// ==========================================
app.post('/api/Login', Login);
app.post('/api/login', Login);
app.post('/api/Register', Register);
app.post('/api/register', Register);
app.use(otpRoutes);
app.post('/api/ContactUS', ContactUS);
app.post('/api/FascilatorComments',FascilatorComments)
app.get('/api/OrgmasterData',OrgmasterData);

// ==========================================
// 2. SESSION LIFECYCLE MANAGEMENT ROUTES
// ==========================================
app.use(authRoutes);

// ==========================================
// 3. ROLE-PROTECTED BACKEND ROUTES
// ==========================================

// Global navigation menu (any authenticated user)
app.post('/api/Menu', authenticateSession, MenuBar);

// Admin & Superadmin Dashboard & Request Progress
app.get('/api/AdminDash', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), AdminDash);
app.get('/api/AdminClientData', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), AdminClientData);
app.post('/api/AdminRequestProgress', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), AdminRequestProgress);
app.post('/api/PaymentAdminData', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), PaymentAdminData);
app.post('/api/UpdateFinalReport', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), UpdateFinalReport);
app.post('/api/FacilitatorCommentsUpdate', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), FacilitatorCommentsUpdate);
app.post('/api/OrgsByFacilitator', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), OrgsByFacilitator);
app.post('/api/FascilatorDashboard', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), FascilatorDashboard);
app.post('/api/FacilitatorDashboard', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), FascilatorDashboard);
app.get('/api/MasterManage', authenticateSession, authorizeRoles('Admin', 'Superadmin','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), MasterManage);
app.post('/api/MasterUserUpdate', authenticateSession, authorizeRoles('Admin', 'Superadmin'), MasterUserUpdate);
app.post('/api/PDFBase64', authenticateSession, authorizeRoles('Admin', 'Superadmin', 'Client', 'Fascilator', 'ContributorAdmin', 'ContributorUser', 'Contributor'), PDFBase64);

// Client Verification & Status Management
app.post('/api/UpdateClientStatus', authenticateSession, authorizeRoles('Admin', 'Superadmin', 'Fascilator','Client', 'Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), UpdateClientStatus);
app.post('/api/ClientDynamicfield', authenticateSession, authorizeRoles('Client', 'Fascilator', 'Admin', 'Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor'), ClientDynamicfield);
app.post('/api/ClientEmpData', authenticateSession, authorizeRoles('Client', 'Fascilator', 'Admin', 'Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor'), ClientEmpData);
app.post('/api/ReviewClientData', authenticateSession, authorizeRoles('Client', 'Fascilator', 'Admin', 'Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor'), ReviewClientData);
app.post('/api/ClientDocumentUpdate', authenticateSession, authorizeRoles('Client', 'Fascilator', 'Admin', 'Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor'), updateClientDocuments);
app.post('/api/ClientEmpStatus', authenticateSession, authorizeRoles('Client', 'Fascilator', 'Admin', 'Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor'), ClientEmpStatus);
app.post('/api/ClientDownloadMail', authenticateSession, authorizeRoles('Client','Fascilator', 'Admin', 'Superadmin'), ClientDownloadMail);

// OrgMaster Management (Superadmin only)
app.post('/api/Orgmastermanage', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), Orgmastermanage);
// app.get('/api/OrgmasterData', authenticateSession, authorizeRoles('Superadmin','Client','Fascilator','ContributorAdmin', 'ContributorUser', 'Contributor'), OrgmasterData);
app.post('/api/OrgmasterDelete', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), OrgmasterDelete);
app.post('/api/OrgmasterNameUpdate', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), OrgmasterNameUpdate);
app.post('/api/OrgmasterSearch', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), OrgmasterSearch);

// Facilitators Management (Superadmin only)
app.get('/api/FacilitatorsData', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), FacilitatorsData);
app.post('/api/FacilitatorStatus', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin'), UpdateFacilitatorStatus);
app.get('/api/FacilitatorsMapData', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), FacilitatorsMapData);
app.post('/api/MapFacilitatorToOrg', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), MapFacilitatorToOrg);
app.post('/api/DeleteFacilitatorOrgMap', authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'), DeleteFacilitatorOrgMap);

// Contributor Admin Management
app.get('/api/ContributorAdminData', authenticateSession, authorizeRoles('ContributorAdmin', 'Admin', 'Superadmin','Client','Fascilator'), ContributorAdminData);
app.post('/api/ContributorAdminFormDynamic', authenticateSession, authorizeRoles('ContributorAdmin', 'Admin', 'Superadmin','Client','Fascilator'), ContributorAdminFormDynamic);
app.post('/api/ContributorEditData', authenticateSession, authorizeRoles('ContributorAdmin', 'Admin', 'Superadmin','Client','Fascilator'), ContributorEditData);
app.post('/api/ContributorUpdate', authenticateSession, authorizeRoles('ContributorAdmin', 'Admin', 'Superadmin','Client','Fascilator'), ContributorUpdate);
app.post('/api/ContributorDelete', authenticateSession, authorizeRoles('ContributorAdmin', 'Admin', 'Superadmin','Client','Fascilator'), ContributorDelete);

// Contributor General & User Endpoints
app.post('/api/ContributorData', authenticateSession, authorizeRoles('ContributorAdmin', 'ContributorUser', 'Contributor', 'Admin', 'Superadmin','Client','Fascilator'), ContributorData);
app.post('/api/ContributorEmpSearch', authenticateSession, authorizeRoles('ContributorAdmin', 'ContributorUser', 'Contributor', 'Admin', 'Superadmin','Client','Fascilator'), ContributorEmpSearch);
app.post('/api/ContributorServiceRequest', authenticateSession, authorizeRoles('ContributorAdmin', 'ContributorUser', 'Contributor', 'Admin', 'Superadmin','Client','Fascilator'), ContributorServiceRequest);
app.post('/api/ContributorDash', authenticateSession, authorizeRoles('ContributorAdmin', 'ContributorUser', 'Contributor', 'Admin', 'Superadmin','Client', 'Fascilator'), ContributorDash);

// Documents & Reports
app.post('/api/DownloadUpdatePDF', authenticateSession, authorizeRoles('ContributorAdmin', 'ContributorUser', 'Contributor', 'Admin', 'Superadmin','Client','Fascilator'),DownloadUpdatePDF);

// Payment Gateways
app.post('/api/Payment/CreateOrder', authenticateSession, authorizeRoles('Client', 'Admin', 'Superadmin','ContributorAdmin','ContributorUser','Contributor','Fascilator'), createPaymentOrder);
app.post('/api/Payment/Verify', authenticateSession, authorizeRoles('Client', 'Admin', 'Superadmin','ContributorAdmin','ContributorUser','Contributor','Fascilator'), verifyPayment);
app.post('/api/Payment/Failure', authenticateSession, authorizeRoles('Client', 'Admin', 'Superadmin','ContributorAdmin','ContributorUser','Contributor','Fascilator'), reportPaymentFailure);
app.get('/api/Payment/Transaction/:orderId', authenticateSession, authorizeRoles('Client', 'Admin', 'Superadmin','ContributorAdmin','ContributorUser','Contributor','Fascilator'), getPaymentTransaction);
app.post('/api/CreateFacilitator',authenticateSession, authorizeRoles('Superadmin','ContributorAdmin', 'ContributorUser', 'Contributor','Client','Fascilator'),CreateFacilitator)

app.listen(PORT, () => {
    console.log(`Server is listening ${PORT}`);
    console.log('[Auth] Session authentication active (10 minutes inactivity timeout enforced).');
    console.log('[Payment] Razorpay configuration:', {
        apiKeyPresent: Boolean(process.env.RAZORPAY_API_KEY),
        secretKeyPresent: Boolean(process.env.RAZORPAY_SECRET_KEY),
        database: process.env.DB_NAME || 'WorkTrailTest'
    });
});