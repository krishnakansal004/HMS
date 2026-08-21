import { useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync.js";
import { patientsApi } from "../../api/patients.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Input.jsx";
import {
  Table,
  Thead,
  Th,
  Tr,
  Td,
  Spinner,
  EmptyState,
  ErrorState,
} from "../../components/ui/Table.jsx";
import { formatDate, fullName, initials } from "../../utils/format.js";
import PatientForm from "./PatientForm.jsx";
import { Link } from "react-router-dom";
const PAGE_SIZE = 15;

export default function PatientsList() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () =>
      patientsApi.list({ search: search || undefined, page, limit: PAGE_SIZE }),
    [search, page],
  );

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(patient) {
    setEditing(patient);
    setFormOpen(true);
  }

  const patients = data?.data || [];
  const total = data?.total ?? patients.length;
  const pages = data?.pages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Patients
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            {total} registered {total === 1 ? "patient" : "patients"}
          </p>
        </div>
        <Button icon={Plus} onClick={openCreate}>
          Register patient
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)]">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
            <Input
              placeholder="Search by name, phone, or email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" icon={Search}>
              Search
            </Button>
          </form>
        </div>

        {loading ? (
          <Spinner label="Loading patients…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search
                ? "No patients match your search"
                : "No patients registered yet"
            }
            description={
              search
                ? "Try a different name, phone, or email."
                : "Register your first patient to get started."
            }
            action={
              !search && (
                <Button size="sm" icon={Plus} onClick={openCreate}>
                  Register patient
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Patient</Th>
                <Th>Phone</Th>
                <Th>Blood group</Th>
                <Th>Date of birth</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <tbody>
                {patients.map((p) => (
                  <Tr key={p.patient_id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(fullName(p))}
                        </span>

                        <div>
                          <Link
                            to={`/patients/${p.patient_id}`}
                            className="font-medium hover:text-[var(--color-primary)] hover:underline"
                          >
                            {fullName(p)}
                          </Link>

                          <p className="text-xs text-[var(--color-ink-faint)] font-mono-data">
                            {p.patient_id?.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td>{p.phone || "—"}</Td>
                    <Td>{p.blood_group || "—"}</Td>
                    <Td>{formatDate(p.date_of_birth)}</Td>

                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-ink-soft)]">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ChevronRight}
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
        patient={editing}
      />
    </div>
  );
}
