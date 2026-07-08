import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
    getPatientProfile, 
    updatePatient, 
    uploadPatientReport, 
    assignBedToPatient, 
    dischargePatient, 
    listBeds, 
    createPrescription, 
    issuePrescription, 
    emailPrescription, 
    updateAppointment, 
    API_BASE 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { todayStr } from '../utils/time';

function PatientInfo({ patient, onSave, isDoctorView }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(patient);

    useEffect(() => {
        setFormData(patient)
    }, [patient])

    const handleSave = async () => {
        await onSave(formData);
        setIsEditing(false);
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Patient Information</h2>
                {!isDoctorView && (
                    <button onClick={() => setIsEditing(!isEditing)} className="btn btn-sm">{isEditing ? 'Cancel' : 'Edit'}</button>
                )}
            </div>
            {isEditing ? (
                <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">First name</label>
                            <input className="input" value={formData.firstName || ''} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                        </div>
                        <div>
                            <label className="label">Last name</label>
                            <input className="input" value={formData.lastName || ''} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="label">Phone</label>
                            <input className="input" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="label">Date of birth</label>
                            <input type="date" className="input" value={formData.dob ? new Date(formData.dob).toISOString().slice(0, 10) : ''} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                        </div>
                        <div>
                            <label className="label">Gender</label>
                            <select className="input" value={formData.gender || ''} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Blood group</label>
                            <input className="input" value={formData.bloodGroup || ''} onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="label">Address</label>
                        <textarea className="input" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="label">Emergency contact name</label>
                            <input className="input" value={(formData.emergencyContact && formData.emergencyContact.name) || ''} onChange={e => setFormData({ ...formData, emergencyContact: { ...(formData.emergencyContact || {}), name: e.target.value } })} />
                        </div>
                        <div>
                            <label className="label">Emergency contact phone</label>
                            <input className="input" value={(formData.emergencyContact && formData.emergencyContact.phone) || ''} onChange={e => setFormData({ ...formData, emergencyContact: { ...(formData.emergencyContact || {}), phone: e.target.value } })} />
                        </div>
                        <div>
                            <label className="label">Emergency relation</label>
                            <input className="input" value={(formData.emergencyContact && formData.emergencyContact.relation) || ''} onChange={e => setFormData({ ...formData, emergencyContact: { ...(formData.emergencyContact || {}), relation: e.target.value } })} />
                        </div>
                    </div>
                    <div>
                        <label className="label">Allergies (comma separated)</label>
                        <input className="input" value={Array.isArray(formData.allergies) ? formData.allergies.join(', ') : (formData.allergies || '')} onChange={e => setFormData({ ...formData, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <button onClick={handleSave} className="btn btn-primary">Save</button>
                        <button onClick={() => { setIsEditing(false); setFormData(patient) }} className="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <div><strong>Name:</strong> {patient.firstName} {patient.lastName}</div>
                    <div><strong>DoB:</strong> {patient.dob ? new Date(patient.dob).toLocaleDateString() : '-'}</div>
                    <div><strong>Gender:</strong> {patient.gender}</div>
                    <div><strong>Blood Group:</strong> {patient.bloodGroup}</div>
                    <div><strong>Email:</strong> {patient.email}</div>
                    <div><strong>Phone:</strong> {patient.phone}</div>
                    <div className="col-span-2"><strong>Address:</strong> {patient.address}</div>
                </div>
            )}
        </div>
    );
}

function MedicalHistory({ patient, onSave, isDoctorView }) {
    const [isAdding, setIsAdding] = useState(false);
    const [newEntry, setNewEntry] = useState({ condition: '', notes: '', diagnosedAt: todayStr() });

    const handleAddEntry = async () => {
        const updatedHistory = [...(patient.medicalHistory || []), newEntry];
        await onSave({ ...patient, medicalHistory: updatedHistory });
        setIsAdding(false);
        setNewEntry({ condition: '', notes: '', diagnosedAt: todayStr() });
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Medical History</h2>
                {!isDoctorView && (
                    <button onClick={() => setIsAdding(!isAdding)} className="btn btn-sm">{isAdding ? 'Cancel' : 'Add Entry'}</button>
                )}
            </div>
            {isAdding && !isDoctorView && (
                <div className="grid grid-cols-1 gap-4 mb-4">
                    <input type="text" value={newEntry.condition} onChange={e => setNewEntry({ ...newEntry, condition: e.target.value })} placeholder="Condition" className="input" />
                    <textarea value={newEntry.notes} onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })} placeholder="Notes" className="input"></textarea>
                    <input type="date" value={newEntry.diagnosedAt} onChange={e => setNewEntry({ ...newEntry, diagnosedAt: e.target.value })} className="input" />
                    <button onClick={handleAddEntry} className="btn btn-primary">Save Entry</button>
                </div>
            )}
            <ul className="space-y-2">
                {(patient.medicalHistory || []).map((entry, index) => (
                    <li key={index} className="border-b pb-2">
                        <p className="font-semibold">{entry.condition}</p>
                        <p className="text-sm text-slate-600">Timeline: {entry.startDate ? new Date(entry.startDate).toLocaleDateString() : (entry.diagnosedAt ? new Date(entry.diagnosedAt).toLocaleDateString() : '—')} {entry.endDate ? ` — ${new Date(entry.endDate).toLocaleDateString()}` : ''}</p>
                        {entry.treatment && <p className="mt-1"><strong>Treatment:</strong> {entry.treatment}</p>}
                        {entry.notes && <p className="mt-1 text-sm">{entry.notes}</p>}
                        {entry.attachments && entry.attachments.length > 0 && (
                            <div className="mt-2">
                                <strong>Attachments:</strong>
                                <ul className="list-disc ml-6 mt-1">
                                    {entry.attachments.map((a, i) => (
                                        <li key={i}><a href={`${API_BASE}${a.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.title || a.originalName || 'Document'}</a></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function DigitalReports({ patient, onUpload, isDoctorView }) {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');

    const handleUpload = () => {
        if (file && title) {
            const formData = new FormData();
            formData.append('report', file);
            formData.append('title', title);
            onUpload(formData);
            setFile(null);
            setTitle('');
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Digital Reports</h2>
            {!isDoctorView && (
                <div className="grid grid-cols-1 gap-4 mb-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Report Title" className="input" />
                    <input type="file" onChange={e => setFile(e.target.files[0])} className="input" />
                    <button onClick={handleUpload} className="btn btn-primary">Upload Report</button>
                </div>
            )}
            <ul className="space-y-2">
                {(patient.digitalReports || []).map((report, index) => (
                    <li key={index}>
                        <a href={`${API_BASE}${report.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{report.title || report.originalName}</a>
                        <span className="text-sm text-gray-500 ml-2">({new Date(report.uploadedAt).toLocaleDateString()})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function InpatientManagement({ patient, onAssignBed, onDischarge, wards }) {
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [summary, setSummary] = useState('');
    const [referral, setReferral] = useState('');

    // Dynamically query available beds when ward selection changes (0 useEffect hooks)
    const { data: bedsRaw = [] } = useQuery({
        queryKey: ['beds', selectedWard],
        queryFn: () => listBeds(selectedWard),
        enabled: !!selectedWard,
        staleTime: 30000, // Bed availability changes relatively frequently, 30s is a safe threshold
    });

    const beds = useMemo(() => {
        return bedsRaw.filter(b => !b.isOccupied);
    }, [bedsRaw]);

    const handleAssign = () => {
        if (selectedBed) {
            onAssignBed(selectedBed);
        }
    };

    const handleDischarge = () => {
        onDischarge({ summary, referral });
    };

    if (patient.inpatient?.isAdmitted) {
        return (
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Inpatient Details</h2>
                <p><strong>Status:</strong> Admitted</p>
                <div className="mt-4">
                    <h3 className="text-lg font-semibold">Discharge Patient</h3>
                    <textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Discharge Summary" className="input mt-2"></textarea>
                    <input type="text" value={referral} onChange={e => setReferral(e.target.value)} placeholder="Referral" className="input mt-2" />
                    <button onClick={handleDischarge} className="btn btn-primary mt-2">Discharge</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Assign Bed</h2>
            <div className="grid grid-cols-2 gap-4">
                <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="input">
                    <option value="">Select Ward</option>
                    {(wards || []).map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
                <select value={selectedBed} onChange={e => setSelectedBed(e.target.value)} className="input" disabled={!selectedWard}>
                    <option value="">Select Bed</option>
                    {beds.map(b => <option key={b._id} value={b._id}>{b.bedNumber}</option>)}
                </select>
            </div>
            <button onClick={handleAssign} className="btn btn-primary mt-4" disabled={!selectedBed}>Assign Bed</button>
        </div>
    );
}

function Prescriptions({ patient, onSave, prescriptions, templates, onIssue }) {
    const [isCreating, setIsCreating] = useState(false);
    const [newPrescription, setNewPrescription] = useState({ medicines: [{ name: '', dosage: '', frequency: '', duration: '' }], tests: [{ name: '', notes: '' }], notes: '', followUp: '' });
    const [selectedTemplateForEmail, setSelectedTemplateForEmail] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');

    const applyTemplate = (id) => {
        const tpl = (templates || []).find(t => t._id === id);
        if (tpl) {
            setNewPrescription({ 
                medicines: tpl.medicines.length ? tpl.medicines.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration })) : [{ name: '', dosage: '', frequency: '', duration: '' }], 
                tests: tpl.tests.length ? tpl.tests.map(t => ({ name: t.name, notes: t.notes })) : [{ name: '', notes: '' }], 
                notes: tpl.notes || '', 
                followUp: '' 
            });
        }
    };

    const handleSave = async () => {
        await onSave({ ...newPrescription, patientId: patient._id });
        setIsCreating(false);
    };

    const handleMedicineChange = (index, field, value) => {
        const updatedMedicines = [...newPrescription.medicines];
        updatedMedicines[index][field] = value;
        setNewPrescription({ ...newPrescription, medicines: updatedMedicines });
    };

    const addMedicine = () => {
        setNewPrescription({ ...newPrescription, medicines: [...newPrescription.medicines, { name: '', dosage: '', frequency: '', duration: '' }] });
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Prescriptions</h2>
                <button onClick={() => setIsCreating(!isCreating)} className="btn btn-sm">{isCreating ? 'Cancel' : 'Create Prescription'}</button>
            </div>
            <div className="flex items-center gap-3 mb-4">
                <label className="label !mb-0">Email Template</label>
                <select className="input" value={selectedTemplateForEmail} onChange={e => setSelectedTemplateForEmail(e.target.value)}>
                    <option value="">Default Layout</option>
                    {(templates || []).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
            </div>
            {isCreating && (
                <div>
                    <div className="grid gap-4">
                        <div>
                            <label className="label">Template</label>
                            <select className="input" value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); applyTemplate(e.target.value); }}>
                                <option value="">-- None --</option>
                                {(templates || []).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Medicines</label>
                            {newPrescription.medicines.map((m, idx) => (
                                <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
                                    <input className="input" placeholder="Name" value={m.name} onChange={e => handleMedicineChange(idx, 'name', e.target.value)} />
                                    <input className="input" placeholder="Dosage" value={m.dosage} onChange={e => handleMedicineChange(idx, 'dosage', e.target.value)} />
                                    <input className="input" placeholder="Frequency" value={m.frequency} onChange={e => handleMedicineChange(idx, 'frequency', e.target.value)} />
                                    <input className="input" placeholder="Duration" value={m.duration} onChange={e => handleMedicineChange(idx, 'duration', e.target.value)} />
                                </div>
                            ))}
                            <button className="btn btn-secondary btn-sm" type="button" onClick={addMedicine}>+ Add Medicine</button>
                        </div>
                        <div>
                            <label className="label">Notes</label>
                            <textarea className="input" value={newPrescription.notes} onChange={e => setNewPrescription({ ...newPrescription, notes: e.target.value })} />
                        </div>
                        <div>
                            <label className="label">Follow-up Date</label>
                            <input type="date" className="input" value={newPrescription.followUp} onChange={e => setNewPrescription({ ...newPrescription, followUp: e.target.value })} />
                        </div>
                    </div>
                    <button onClick={handleSave} className="btn btn-primary mt-4">Save Prescription</button>
                </div>
            )}
            <ul className="space-y-4">
                {(prescriptions || []).map(p => (
                    <li key={p._id} className="border p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                            <p><strong>Date:</strong> {new Date(p.date || p.createdAt || Date.now()).toLocaleDateString()}</p>
                            <div className="text-xs text-slate-500">Doctor: {p.doctor?.name || 'Assigned'}</div>
                        </div>
                        <div className="mt-2 text-xs">Status: <span className="font-medium capitalize">{p.pharmacyStatus}</span></div>
                        {p.dispensedItems && p.dispensedItems.length > 0 && (
                            <div className="mt-2">
                                <div className="text-xs font-semibold">Dispensed:</div>
                                {p.dispensedItems.map((di, i) => (
                                    <div key={i} className="text-[11px] text-slate-600">{di.name} x {di.quantity}</div>
                                ))}
                            </div>
                        )}
                        {p.pharmacyStatus === 'pending' && (
                            <button className="btn btn-secondary btn-sm mt-2" onClick={() => onIssue(p._id)}>Mark Issued</button>
                        )}
                        <button className="btn btn-primary btn-sm mt-2 ml-2" onClick={async () => {
                            const email = window.prompt('Send to email:', patient.email || '')
                            if (!email) return
                            await emailPrescription(p._id, { to: email, templateId: selectedTemplateForEmail || undefined })
                        }}>Send to Email</button>
                        {p.followUp && <div className="mt-2 text-[11px]">Follow-up: {new Date(p.followUp).toLocaleDateString()}</div>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function AppointmentsForPatient({ patient, appointments, onUpdateAppointment }) {
    const { user } = useAuth()

    const shareMeeting = async (apt) => {
        if (apt.type !== 'online') return
        const link = window.prompt('Enter meeting link URL', apt.meetingLink || '')
        if (!link) return
        const email = window.prompt('Send to email (optional)', apt.patientEmail || patient.email || '')
        await onUpdateAppointment(apt._id, { meetingLink: link, sendMeetingEmail: true, emailOverride: email || undefined });
    }

    if (user?.role !== 'doctor') return null
    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Appointments</h2>
            </div>
            {appointments.length === 0 ? (
                <div className="text-slate-500 text-sm">No appointments found for this patient.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[680px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600">
                                <th className="px-3 py-2 text-left">When</th>
                                <th className="px-3 py-2 text-left">Mode</th>
                                <th className="px-3 py-2 text-left">Token</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(a => (
                                <tr key={a._id} className="border-t">
                                    <td className="px-3 py-2">{new Date(a.slotStart).toLocaleString()}</td>
                                    <td className="px-3 py-2 capitalize">{a.type || 'online'}</td>
                                    <td className="px-3 py-2">#{a.tokenNumber}</td>
                                    <td className="px-3 py-2 capitalize">{a.status}</td>
                                    <td className="px-3 py-2 text-right">
                                        {a.type === 'online' && (
                                            <button className="btn btn-primary btn-xs" onClick={() => shareMeeting(a)}>Share Link</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// Memoized Subcomponents
const PatientInfoMemo = React.memo(PatientInfo);
const MedicalHistoryMemo = React.memo(MedicalHistory);
const DigitalReportsMemo = React.memo(DigitalReports);
const InpatientManagementMemo = React.memo(InpatientManagement);
const PrescriptionsMemo = React.memo(Prescriptions);
const AppointmentsForPatientMemo = React.memo(AppointmentsForPatient);

export default function PatientProfile() {
    useProfileRender('PatientProfile', true);
    const { id } = useParams();
    const { user } = useAuth()
    const isDoctorView = user?.role === 'doctor'

    // Consolidated single page-level query
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['patientProfile', id],
        queryFn: () => getPatientProfile(id),
    });

    const handleUpdatePatient = useCallback(async (formData) => {
        try {
            await updatePatient(id, formData);
            refetch();
        } catch (error) {
            console.error('Failed to update patient', error);
        }
    }, [id, refetch]);

    const handleUploadReport = useCallback(async (formData) => {
        try {
            await uploadPatientReport(id, formData);
            refetch();
        } catch (error) {
            console.error('Failed to upload report', error);
        }
    }, [id, refetch]);

    const handleAssignBed = useCallback(async (bedId) => {
        try {
            await assignBedToPatient(id, bedId);
            refetch();
        } catch (error) {
            console.error('Failed to assign bed', error);
        }
    }, [id, refetch]);

    const handleDischarge = useCallback(async (formData) => {
        try {
            await dischargePatient(id, formData);
            refetch();
        } catch (error) {
            console.error('Failed to discharge patient', error);
        }
    }, [id, refetch]);

    const handleCreatePrescription = useCallback(async (formData) => {
        try {
            await createPrescription(formData);
            toast.success('Prescription saved')
            refetch();
        } catch (error) {
            console.error('Failed to create prescription', error);
            toast.error(error?.message || 'Failed to create prescription')
        }
    }, [refetch]);

    const handleIssuePrescription = useCallback(async (prescriptionId) => {
        try {
            await issuePrescription(prescriptionId);
            refetch();
        } catch (error) {
            console.error('Failed to issue prescription', error);
        }
    }, [refetch]);

    const handleUpdateAppointment = useCallback(async (appointmentId, updateData) => {
        try {
            await updateAppointment(appointmentId, updateData);
            toast.success('Meeting link saved and emailed')
            refetch();
        } catch (error) {
            console.error('Failed to update appointment', error);
        }
    }, [refetch]);

    if (isLoading) {
        return <div className="p-6">Loading...</div>;
    }

    if (!data || !data.patient) {
        return <div className="p-6">Patient not found.</div>;
    }

    const { patient, prescriptions, appointments, wards, templates } = data;

    return (
        <div className="p-6 space-y-6">
            <PatientInfoMemo patient={patient} onSave={handleUpdatePatient} isDoctorView={isDoctorView} />
            <AppointmentsForPatientMemo patient={patient} appointments={appointments} onUpdateAppointment={handleUpdateAppointment} />
            <MedicalHistoryMemo patient={patient} onSave={handleUpdatePatient} isDoctorView={isDoctorView} />
            <DigitalReportsMemo patient={patient} onUpload={handleUploadReport} isDoctorView={isDoctorView} />
            <InpatientManagementMemo patient={patient} onAssignBed={handleAssignBed} onDischarge={handleDischarge} wards={wards} />
            <PrescriptionsMemo patient={patient} onSave={handleCreatePrescription} prescriptions={prescriptions} templates={templates} onIssue={handleIssuePrescription} />
        </div>
    );
}
