const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  deleteEmployeeAndRemoveAccess,
  deactivateEmployee,
  getEmployeeActivitySummary,
  reactivateEmployee,
} = require('../controllers/employeeManagementController');

// Delete employee and remove access
router.delete('/:employeeId/delete', authMiddleware, deleteEmployeeAndRemoveAccess);

// Deactivate employee (soft delete)
router.put('/:employeeId/deactivate', authMiddleware, deactivateEmployee);

// Reactivate employee
router.put('/:employeeId/reactivate', authMiddleware, reactivateEmployee);

// Get employee activity summary
router.get('/:employeeId/summary', authMiddleware, getEmployeeActivitySummary);

module.exports = router;
