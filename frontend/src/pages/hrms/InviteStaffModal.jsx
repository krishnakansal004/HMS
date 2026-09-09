import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { hrmsApi } from '../../api/hrms.js';
import { ROLE_LABELS } from '../../utils/roles.js';
import { toast } from '../../components/ui/Toast.jsx';

const INVITABLE_ROLES = [
  'HOSPITAL_ADMIN',
  'RECEPTIONIST',
  'NURSE',
  'ACCOUNTANT',
  'CASHIER',
  'HR',
  'PHARMACIST',
  'STORE_MANAGER',
  'LAB_TECHNICIAN',
  'RADIOLOGY_TECHNICIAN',
];

const EMPTY_FORM = { name: '', email: '', roleName: 'RECEPTIONIST' };

export default function InviteStaffModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError('');
    }
  }, [open]);

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setError('');
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email || !form.roleName) {
      setError('Name, email, and role are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await hrmsApi.inviteStaff({ name, email, roleName: form.roleName });
      toast.success('Invitation sent. The staff member can set a password from the email link.');
      onSaved?.();
      onClose();
    } catch (requestError) {
      const message = requestError.message || 'Unable to send the staff invitation.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Staff Member"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="invite-staff-form" loading={saving}>Send Invitation</Button>
        </>
      )}
    >
      <form id="invite-staff-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={update('name')}
          placeholder="e.g., Priya Sharma"
        />
        <Input
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          placeholder="name@hospital.com"
          hint="The setup link will be sent to this address."
        />
        <Select label="Role" name="roleName" required value={form.roleName} onChange={update('roleName')}>
          {INVITABLE_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
          ))}
        </Select>
        {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      </form>
    </Modal>
  );
}
