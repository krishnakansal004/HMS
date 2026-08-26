// import { useState } from 'react';
// import Modal from '../../components/ui/Modal.jsx';
// import { Input } from '../../components/ui/Input.jsx';
// import Button from '../../components/ui/Button.jsx';
// import { plansApi } from '../../api/plans.js';
// import { toast } from '../../components/ui/Toast.jsx';

// export default function CreatePlanModal({ open, onClose, onSaved }) {
//   const [form, setForm] = useState({
//     name: '',
//     publicFlag: true,
//     customized: false,
//     priceMonthly: '',
//     limitDoctors: '',
//     limitBeds: ''
//   });
//   const [saving, setSaving] = useState(false);
//   const [errors, setErrors] = useState({});

//   function update(field) {
//     return (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
//   }

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setSaving(true);
//     setErrors({});
    
//     try {
//       // Package the flat form into the nested JSON objects the backend validator expects
//       const payload = {
//         name: form.name,
//         publicFlag: form.publicFlag,
//         customized: form.customized,
//         prices: {
//           monthly: Number(form.priceMonthly) || 0
//         },
//         limits: {
//           doctors: Number(form.limitDoctors) || 999,
//           beds: Number(form.limitBeds) || 999
//         }
//       };

//       await plansApi.create(payload);
//       toast.success(`Subscription plan "${form.name}" created successfully.`);
//       onSaved();
//       onClose();
      
//       // Reset form
//       setForm({ name: '', publicFlag: true, customized: false, priceMonthly: '', limitDoctors: '', limitBeds: '' });
//     } catch (err) {
//       if (err.fieldErrors?.length) {
//         const fe = {};
//         err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
//         setErrors(fe);
//       } else {
//         toast.error(err.message || 'Failed to create plan.');
//       }
//     } finally {
//       setSaving(false);
//     }
//   }

//   return (
//     <Modal
//       open={open}
//       onClose={onClose}
//       title="Create Subscription Plan"
//       size="md"
//       footer={
//         <>
//           <Button variant="secondary" onClick={onClose}>Cancel</Button>
//           <Button onClick={handleSubmit} loading={saving}>Publish Plan</Button>
//         </>
//       }
//     >
//       <form onSubmit={handleSubmit} className="flex flex-col gap-5">
//         <Input 
//           label="Plan Name" 
//           required 
//           value={form.name} 
//           onChange={update('name')} 
//           error={errors.name} 
//           placeholder="e.g., Enterprise Tier" 
//         />
        
//         <div className="grid grid-cols-2 gap-4">
//           <Input 
//             label="Monthly Price (INR)" 
//             type="number" 
//             min="0"
//             value={form.priceMonthly} 
//             onChange={update('priceMonthly')} 
//             placeholder="Leave 0 for free"
//           />
//         </div>

//         <div>
//           <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Resource Limits</h3>
//           <div className="grid grid-cols-2 gap-4">
//             <Input 
//               label="Max Doctors" 
//               type="number" 
//               min="1"
//               value={form.limitDoctors} 
//               onChange={update('limitDoctors')} 
//               placeholder="e.g., 50"
//             />
//             <Input 
//               label="Max Beds" 
//               type="number" 
//               min="1"
//               value={form.limitBeds} 
//               onChange={update('limitBeds')} 
//               placeholder="e.g., 200"
//             />
//           </div>
//         </div>

//         <div className="flex flex-col gap-2 mt-2">
//           <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
//             <input 
//               type="checkbox" 
//               checked={form.publicFlag} 
//               onChange={update('publicFlag')} 
//               className="rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
//             />
//             Make this plan visible on the public marketing site
//           </label>
//           <label className="flex items-center gap-2 text-sm text-[var(--color-ink)] cursor-pointer">
//             <input 
//               type="checkbox" 
//               checked={form.customized} 
//               onChange={update('customized')} 
//               className="rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
//             />
//             This is a custom enterprise plan (Requires access code)
//           </label>
//         </div>
//       </form>
//     </Modal>
//   );
// }
import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { plansApi } from '../../api/plans.js';
import { toast } from '../../components/ui/Toast.jsx';

const emptyForm = {
  name: '', publicFlag: 'true', customized: 'false', 
  priceMonthly: '', priceYearly: '', 
  limitAdmins: '', limitDoctors: '', limitPatients: ''
};

export default function CreatePlanModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setErrors({});
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      // Map flat form data into the structured JSON required by backend
      const payload = {
        name: form.name,
        publicFlag: form.publicFlag === 'true',
        customized: form.customized === 'true',
        prices: {
          monthly: Number(form.priceMonthly) || 0,
          yearly: Number(form.priceYearly) || 0
        },
        limits: {
          admins: Number(form.limitAdmins) || 0,
          doctors: Number(form.limitDoctors) || 0,
          patients: Number(form.limitPatients) || 0
        }
      };

      await plansApi.create(payload);
      toast.success('Subscription plan created successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Subscription Plan" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={saving}>Save Plan</Button>
      </>
    }>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Core Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Plan Name" required value={form.name} onChange={update('name')} placeholder="e.g. Enterprise Tier" />
            <Select label="Visibility" value={form.publicFlag} onChange={update('publicFlag')}>
              <option value="true">Public</option>
              <option value="false">Hidden</option>
            </Select>
            <Select label="Customized" value={form.customized} onChange={update('customized')} hint="Requires access code if true">
              <option value="false">Standard</option>
              <option value="true">Customized</option>
            </Select>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Pricing (₹)</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Monthly Price" type="number" min="0" required value={form.priceMonthly} onChange={update('priceMonthly')} />
            <Input label="Yearly Price" type="number" min="0" required value={form.priceYearly} onChange={update('priceYearly')} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Resource Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Max Admins" type="number" min="1" required value={form.limitAdmins} onChange={update('limitAdmins')} />
            <Input label="Max Doctors" type="number" min="1" required value={form.limitDoctors} onChange={update('limitDoctors')} />
            <Input label="Max Patients" type="number" min="1" required value={form.limitPatients} onChange={update('limitPatients')} />
          </div>
        </div>
      </form>
    </Modal>
  );
}