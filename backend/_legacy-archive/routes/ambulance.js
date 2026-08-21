import express from 'express';
import Ambulance from '../models/Ambulance.js';
import AmbulanceDispatch from '../models/AmbulanceDispatch.js';
import { protect } from '../utils/auth.js';
import { loadTenant } from '../utils/saas.js';
import { allowRolesWithSubadminFeature } from '../utils/permissions.js';
import { logActivity } from '../utils/auditHelper.js';

const router = express.Router();

// ─── AMBULANCE REGISTRY ──────────────────────────────────────────────────

// @desc    Get all ambulance vehicles
// @route   GET /api/ambulance/vehicles
router.get('/vehicles', protect, loadTenant, async (req, res) => {
    try {
        const vehicles = await req.db(Ambulance).find({});
        res.json(vehicles);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load vehicles list' });
    }
});

// @desc    Register a new vehicle
// @route   POST /api/ambulance/vehicles
router.post('/vehicles', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_ambulance'), async (req, res) => {
    try {
        const { vehicleNumber, vehicleModel, driverName, driverPhone, status } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const vehicle = await req.db(Ambulance).create({
            tenantId,
            vehicleNumber,
            vehicleModel,
            driverName,
            driverPhone,
            latitude: 12.9716, // Default to clinic coordinates
            longitude: 77.5946,
            status: status || 'available', // available -> dispatched -> maintenance
            createdBy: req.userId
        });

        await logActivity(req, 'REGISTER_AMBULANCE', 'ambulance', vehicle._id, { vehicleNumber, driverName });
        res.status(201).json(vehicle);
    } catch (e) {
        res.status(500).json({ error: 'Failed to register ambulance vehicle' });
    }
});

// @desc    Update vehicle coordinates / status
// @route   PUT /api/ambulance/vehicles/:id
router.put('/vehicles/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_ambulance'), async (req, res) => {
    try {
        const vehicle = await req.db(Ambulance).findById(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

        vehicle.vehicleNumber = req.body.vehicleNumber || vehicle.vehicleNumber;
        vehicle.vehicleModel = req.body.vehicleModel || vehicle.vehicleModel;
        vehicle.driverName = req.body.driverName || vehicle.driverName;
        vehicle.driverPhone = req.body.driverPhone || vehicle.driverPhone;
        vehicle.status = req.body.status || vehicle.status;
        
        if (req.body.latitude !== undefined) vehicle.latitude = Number(req.body.latitude);
        if (req.body.longitude !== undefined) vehicle.longitude = Number(req.body.longitude);

        const updated = await vehicle.save();
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update vehicle record' });
    }
});

// @desc    Delete vehicle
// @route   DELETE /api/ambulance/vehicles/:id
router.delete('/vehicles/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_ambulance'), async (req, res) => {
    try {
        await req.db(Ambulance).deleteOne({ _id: req.params.id });
        await logActivity(req, 'DELETE_AMBULANCE', 'ambulance', req.params.id);
        res.json({ message: 'Ambulance vehicle removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove vehicle' });
    }
});


// ─── EMERGENCY DISPATCH ENDPOINTS ───────────────────────────────────────

// @desc    Get all dispatches
// @route   GET /api/ambulance/dispatches
router.get('/dispatches', protect, loadTenant, async (req, res) => {
    try {
        const dispatches = await req.db(AmbulanceDispatch).find({}).sort({ createdAt: -1 });
        res.json(dispatches);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load dispatch history' });
    }
});

// @desc    Log a new emergency dispatch
// @route   POST /api/ambulance/dispatches
router.post('/dispatches', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_ambulance'), async (req, res) => {
    try {
        const { callerName, callerPhone, pickupAddress, ambulanceId, severity } = req.body;
        const tenantId = req.tenant?._id || req.user?.tenantId;

        const vehicle = await req.db(Ambulance).findById(ambulanceId);
        if (!vehicle) return res.status(404).json({ error: 'Ambulance vehicle not found' });

        const dispatch = await req.db(AmbulanceDispatch).create({
            tenantId,
            callerName,
            callerPhone,
            pickupAddress,
            ambulance: ambulanceId,
            vehicleNumber: vehicle.vehicleNumber,
            driverName: vehicle.driverName,
            driverPhone: vehicle.driverPhone,
            severity: severity || 'critical', // moderate -> critical -> severe
            status: 'assigned', // assigned -> enroute -> pickedup -> completed -> cancelled
            dispatchedAt: new Date(),
            createdBy: req.userId
        });

        // Update vehicle status
        vehicle.status = 'dispatched';
        await vehicle.save();

        await logActivity(req, 'AMBULANCE_DISPATCH', 'ambulancedispatch', dispatch._id, { ambulanceId, pickupAddress });
        res.status(201).json(dispatch);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to dispatch ambulance' });
    }
});

// @desc    Update dispatch status
// @route   PUT /api/ambulance/dispatches/:id
router.put('/dispatches/:id', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'staff'], 'manage_ambulance'), async (req, res) => {
    try {
        const { status } = req.body;
        const dispatch = await req.db(AmbulanceDispatch).findById(req.params.id);
        if (!dispatch) return res.status(404).json({ error: 'Dispatch record not found' });

        dispatch.status = status;
        if (status === 'completed' || status === 'cancelled') {
            dispatch.completedAt = new Date();
            
            // Release ambulance
            const vehicle = await req.db(Ambulance).findById(dispatch.ambulance);
            if (vehicle) {
                vehicle.status = 'available';
                await vehicle.save();
            }
        }

        const updated = await dispatch.save();
        await logActivity(req, 'UPDATE_AMBULANCE_DISPATCH', 'ambulancedispatch', dispatch._id, { status });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update dispatch record' });
    }
});

export default router;
