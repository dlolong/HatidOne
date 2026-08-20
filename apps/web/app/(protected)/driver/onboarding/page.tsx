import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { getDriverOnboarding, type OnboardingDocument } from '@/lib/driver/data';
import {
  savePersonalDetails,
  saveVehicleDetails,
  submitOnboarding,
  uploadDriverDocument,
  uploadVehicleDocument,
} from './actions';

type OnboardingPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'In progress',
  under_review: 'Under review',
  verified: 'Verified',
  rejected: 'Changes requested',
  suspended: 'Suspended',
};

const DOCUMENT_LABELS: Record<string, string> = {
  drivers_license: "Driver's license",
  professional_license: 'Professional license',
  nbi_clearance: 'NBI clearance',
  medical_certificate: 'Medical certificate',
  registration: 'Vehicle registration',
  insurance: 'Insurance',
  franchise: 'Franchise document',
  inspection_certificate: 'Inspection certificate',
};

function DocumentList({ documents }: { documents: OnboardingDocument[] }) {
  if (documents.length === 0) return <p className="empty-state">No documents uploaded yet.</p>;
  return (
    <ul className="document-list">
      {documents.map((document) => (
        <li key={document.document_type}>
          <span><strong>{DOCUMENT_LABELS[document.document_type] ?? document.document_type}</strong><small>{document.expires_on ? `Expires ${document.expires_on}` : 'No expiration provided'}</small></span>
          <span className={`status-pill status-${document.verification_status}`}>{STATUS_LABELS[document.verification_status] ?? document.verification_status}</span>
          {document.rejection_reason ? <p className="document-rejection">{document.rejection_reason}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function DriverOnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ error, message }, onboarding] = await Promise.all([searchParams, getDriverOnboarding()]);
  const status = onboarding.driver?.verification_status ?? 'pending';
  const editable = status === 'pending' || status === 'rejected';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="onboarding-page">
      <Link className="back-link" href="/driver">← Driver dashboard</Link>
      <header className="onboarding-heading">
        <div><p className="eyebrow">Driver verification</p><h1>Onboarding</h1><p>Complete each section with accurate information. Only authorized operations staff can approve your account.</p></div>
        <span className={`status-pill status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
      </header>

      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      {message ? <p className="notice notice-success" role="status">{message}</p> : null}
      {!editable ? <p className="notice notice-success" role="status">{status === 'verified' ? 'Your driver profile is verified.' : 'Your submission is locked while operations staff review it.'}</p> : null}

      <section className="progress-card" aria-label="Onboarding progress">
        <div><strong>{onboarding.progress.percentage}% complete</strong><span>{onboarding.progress.completedSteps} of {onboarding.progress.totalSteps} sections ready</span></div>
        <progress max={100} value={onboarding.progress.percentage}>{onboarding.progress.percentage}%</progress>
      </section>

      <div className="onboarding-sections">
        <section className="onboarding-card">
          <div className="section-number">1</div><div className="section-copy"><h2>Personal details</h2><p>Your account name is fixed here. Add the contact and operating details needed for review.</p></div>
          <form action={savePersonalDetails} className="form-stack">
            <fieldset disabled={!editable}>
              <div className="form-grid"><label>First name<input disabled value={onboarding.personal?.first_name ?? ''} /></label><label>Last name<input disabled value={onboarding.personal?.last_name ?? ''} /></label></div>
              <label>Phone number<input autoComplete="tel" defaultValue={onboarding.personal?.phone ?? ''} maxLength={30} name="phone" placeholder="09XX XXX XXXX" required type="tel" /></label>
              <label>Preferred service area<input defaultValue={onboarding.driver?.preferred_area ?? ''} maxLength={120} name="preferredArea" placeholder="e.g. Metro Manila" required /></label>
              <SubmitButton pendingLabel="Saving…">Save personal details</SubmitButton>
            </fieldset>
          </form>
        </section>

        <section className="onboarding-card">
          <div className="section-number">2</div><div className="section-copy"><h2>Primary vehicle</h2><p>Vehicle verification is controlled by operations staff and cannot be changed here.</p></div>
          <form action={saveVehicleDetails} className="form-stack">
            <fieldset disabled={!editable}>
              <input name="vehicleId" type="hidden" value={onboarding.vehicle?.id ?? ''} />
              <div className="form-grid"><label>Vehicle type<select defaultValue={onboarding.vehicle?.vehicle_type ?? 'sedan'} name="vehicleType"><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="van">Van</option><option value="motorcycle">Motorcycle</option></select></label><label>Passenger capacity<input defaultValue={onboarding.vehicle?.capacity ?? 4} max={30} min={1} name="capacity" required type="number" /></label></div>
              <div className="form-grid"><label>Brand<input defaultValue={onboarding.vehicle?.brand ?? ''} maxLength={80} name="brand" required /></label><label>Model<input defaultValue={onboarding.vehicle?.model ?? ''} maxLength={80} name="model" required /></label></div>
              <div className="form-grid"><label>Model year<input defaultValue={onboarding.vehicle?.year ?? new Date().getFullYear()} max={new Date().getFullYear() + 1} min={1990} name="year" required type="number" /></label><label>Color<input defaultValue={onboarding.vehicle?.color ?? ''} maxLength={50} name="color" required /></label></div>
              <label>Plate number<input autoCapitalize="characters" defaultValue={onboarding.vehicle?.plate_number ?? ''} maxLength={30} name="plateNumber" required /></label>
              <SubmitButton pendingLabel="Saving…">Save vehicle details</SubmitButton>
            </fieldset>
          </form>
        </section>

        <section className="onboarding-card onboarding-card-wide">
          <div className="section-number">3</div><div className="section-copy"><h2>Private documents</h2><p>PDF, JPG, or PNG up to 5 MB. Files are stored privately and are not publicly accessible.</p></div>
          <div className="document-columns">
            <div><h3>Driver documents</h3><DocumentList documents={onboarding.driverDocuments} />
              <form action={uploadDriverDocument} className="upload-form"><fieldset disabled={!editable || !onboarding.driver}>
                <label>Document type<select name="documentType"><option value="drivers_license">Driver&apos;s license (required)</option><option value="professional_license">Professional license</option><option value="nbi_clearance">NBI clearance</option><option value="medical_certificate">Medical certificate</option></select></label>
                <label>Expiration date<input min={today} name="expiresOn" type="date" /></label><label>Choose file<input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" name="file" required type="file" /></label>
                <SubmitButton pendingLabel="Uploading…">Upload driver document</SubmitButton>
              </fieldset></form>
            </div>
            <div><h3>Vehicle documents</h3><DocumentList documents={onboarding.vehicleDocuments} />
              <form action={uploadVehicleDocument} className="upload-form"><fieldset disabled={!editable || !onboarding.vehicle}>
                <input name="vehicleId" type="hidden" value={onboarding.vehicle?.id ?? ''} />
                <label>Document type<select name="documentType"><option value="registration">Registration (required)</option><option value="insurance">Insurance</option><option value="franchise">Franchise document</option><option value="inspection_certificate">Inspection certificate</option></select></label>
                <label>Expiration date<input min={today} name="expiresOn" type="date" /></label><label>Choose file<input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" name="file" required type="file" /></label>
                <SubmitButton pendingLabel="Uploading…">Upload vehicle document</SubmitButton>
              </fieldset></form>
            </div>
          </div>
        </section>
      </div>

      <section className="submit-card"><div><h2>Submit for review</h2><p>Once submitted, onboarding details are locked until operations staff finish their review or request changes.</p></div><form action={submitOnboarding}><SubmitButton disabled={!editable || !onboarding.progress.canSubmit} pendingLabel="Submitting…">Submit onboarding</SubmitButton></form></section>
    </div>
  );
}
