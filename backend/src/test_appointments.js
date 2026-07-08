import 'dotenv/config';
import { db } from './config/firebase.js';
import FirestoreModel from './models/firestore/FirestoreModel.js';
import Appointment from './models/Appointment.js';
import User from './models/User.js';

const doctorId = 'Iaf2nyFyI8qSqmsbBcbY';

async function run() {
  let tenantId = null
  try {
    const docUser = await User.findById(doctorId).select('tenantId')
    if (docUser) tenantId = docUser.tenantId
  } catch (e) { }

  const dbWrapper = (modelOrName) => {
    const actualTenantId = tenantId || null
    if (typeof modelOrName === 'string') {
      return new FirestoreModel(modelOrName, actualTenantId)
    }
    return modelOrName.forHospital(actualTenantId)
  }

  // 11:30 AM (free slot)
  const targetDate = new Date('2026-06-10T06:00:00.000Z');
  // 09:30 AM (booked slot)
  const clashDate = new Date('2026-06-10T04:00:00.000Z');

  console.log('Testing dbWrapper(Appointment).findOne:');

  const clash1 = await dbWrapper(Appointment).findOne({
    doctor: doctorId,
    slotStart: targetDate
  });
  console.log('Clash for 11:30 AM (expecting null):', clash1);

  const clash2 = await dbWrapper(Appointment).findOne({
    doctor: doctorId,
    slotStart: clashDate
  });
  console.log('Clash for 09:30 AM (expecting object):', clash2 ? clash2._id : null);

  process.exit(0);
}

run().catch(console.error);
