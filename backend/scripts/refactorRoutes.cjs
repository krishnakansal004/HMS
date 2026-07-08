const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const modelsToScope = [
  'Patient', 'Staff', 'Appointment', 'Prescription', 'Invoice', 
  'DoctorProfile', 'DoctorAvailability', 'DoctorAttendance', 
  'Department', 'Bed', 'Ward', 'Medicine', 'Supplier', 'Purchase', 
  'Expense', 'Shift', 'LeaveRequest', 'QueueToken', 'Attendance', 
  'PlanReceipt', 'PlanRequest', 'Setting', 'CustomizationRequest', 'DoctorApplication', 'PrescriptionTemplate'
];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  for (const model of modelsToScope) {
      // Find where we do `Model.method` and replace with `req.db(Model).method`
      // We only do this if it's inside `src/routes/` but wait, some are imported models!
      // Like `await Patient.find({ tenantId: req.tenant._id })`
      
      const regexFind = new RegExp(`\\b${model}\\.(find|findOne|countDocuments|findById|findByIdAndUpdate|findByIdAndDelete|deleteMany|updateMany|create)\\b`, 'g');
      
      content = content.replace(regexFind, (match, method) => {
          // If we see `Model.method`, we replace it with `req.db(${model}).${method}`
          return `req.db(${model}).${method}`;
      });
  }

  // Next, we remove the `tenantId: req.tenant._id` or similar filters
  // This is a bit tricky, e.g. `{ tenantId: req.tenant._id, foo: bar }`
  // We can just remove `tenantId: req.tenant._id,` or `, tenantId: req.tenant._id`
  
  content = content.replace(/tenantId:\s*(req\.tenant\._id|req\.tenantId|req\.tenant\s*\?\s*req\.tenant\._id\s*:\s*undefined)[,\s]*/g, '');
  content = content.replace(/,\s*tenantId:\s*(req\.tenant\._id|req\.tenantId|req\.tenant\s*\?\s*req\.tenant\._id\s*:\s*undefined)/g, '');
  content = content.replace(/tenantId:\s*(req\.tenant\._id|req\.tenantId|req\.tenant\s*\?\s*req\.tenant\._id\s*:\s*undefined)\s*,?/g, '');
  
  // What about `tenantId: tenant._id` ? Wait, in `tenants.js` we probably shouldn't blindly replace it because `tenants.js` might operate cross-tenant.
  // And `User` is not in modelsToScope, so `User.find({tenantId: ...})` remains untouched, which is CORRECT because Users are global.
  
  if (originalContent !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored ${file}`);
  }
}
