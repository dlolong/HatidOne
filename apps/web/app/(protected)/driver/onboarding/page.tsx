import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isExpirationCurrent } from '@/lib/driver/onboarding';
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

function DocumentList({ documents, replacementHref }: { documents: OnboardingDocument[]; replacementHref?: string }) {
  if (documents.length === 0) return <p className="empty-state">No documents uploaded yet.</p>;
  return (
    <ul className="document-list">
      {documents.map((document) => (
        <li key={document.document_type}>
          <span><strong>{DOCUMENT_LABELS[document.document_type] ?? document.document_type}</strong><small>{document.expires_on ? `Expires ${document.expires_on}` : 'No expiration provided'}</small></span>
          <span className={`status-pill status-${document.verification_status}`}>{STATUS_LABELS[document.verification_status] ?? document.verification_status}</span>
          {document.rejection_reason ? <p className="document-rejection">{document.rejection_reason}{replacementHref && document.verification_status === 'rejected' && <> <a href={replacementHref}>Replace this document</a></>}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function DriverOnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ error, message }, onboarding] = await Promise.all([searchParams, getDriverOnboarding()]);
  if (!onboarding.driver) redirect('/driver-application');
  const status = onboarding.driver.verification_status;
  const editable = status === 'pending' || status === 'rejected';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const missingItems = [
    !onboarding.personal?.phone || !onboarding.driver.preferred_area ? { label: 'Add your phone number and service area', href: '#personal' } : null,
    !onboarding.vehicle ? { label: 'Save your primary vehicle', href: '#vehicle' } : null,
    !onboarding.driverDocuments.some(document => document.document_type === 'drivers_license' && (!editable || document.verification_status === 'pending') && isExpirationCurrent(document.expires_on, today)) ? { label: 'Upload or replace the required current driver’s license', href: '#driver-document-upload' } : null,
    !onboarding.vehicleDocuments.some(document => document.document_type === 'registration' && (!editable || document.verification_status === 'pending') && isExpirationCurrent(document.expires_on, today)) ? { label: 'Upload or replace the required current vehicle registration', href: '#vehicle-document-upload' } : null,
  ].filter(item => item !== null);
  if (status === 'suspended') return <section className="detail-card"><p className="eyebrow">Driver application</p><h1>Driver access restricted</h1><p>Your application cannot be restarted to bypass this restriction. Contact the operations representative who manages your application for the available review process.</p><Link className="button button-secondary" href="/account">Back to account</Link></section>;

  return (
    <div className="onboarding-page">
      <Link className="back-link" href="/account">← Your account</Link>
      <header className="onboarding-heading">
        <div><p className="eyebrow">Driver application</p><h1>{status === 'under_review' ? 'Application submitted' : status === 'verified' ? 'Application approved' : status === 'rejected' ? 'Update your application' : 'Complete your driver application'}</h1><p>{status === 'under_review' ? "We’re reviewing your details. You cannot accept trips until your application is approved." : "Complete your personal details, vehicle and documents, then submit for review. Saved information stays here when you return."}</p></div>
        <span className={`status-pill status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
      </header>

      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      {message ? <p className="notice notice-success" role="status">{message}</p> : null}
      {!editable ? <p className="notice" role="status">{status === 'verified' ? 'Driver operations remain subject to current account, vehicle and document eligibility.' : 'Your submission is read-only while operations reviews it. You can view your saved application below.'}</p> : null}
      {status === 'under_review' && <a className="button button-secondary" href="#personal">View application</a>}
      {status === 'verified' && onboarding.profile.role === 'driver' && <Link className="button button-primary" href="/driver">Open driver dashboard</Link>}
      {status === 'rejected' && <p className="notice notice-error">Review the item-specific reasons under Documents. Replace the items that need attention, then resubmit using the existing correction process.</p>}
      <nav aria-label="Application sections"><ol className="application-steps"><li><a href="#personal">1 · Personal details</a></li><li><a href="#vehicle">2 · Vehicle</a></li><li><a href="#documents">3 · Documents</a></li><li><a href="#review">4 · Review and submit</a></li></ol></nav>
      {editable && missingItems.length > 0 && <section className="notice" aria-label="Missing application items"><strong>Still needed before submission</strong><ul>{missingItems.map(item => <li key={item.label}><a href={item.href}>{item.label}</a></li>)}</ul></section>}

      <section className="progress-card" aria-label="Onboarding progress">
        <div><strong>{onboarding.progress.percentage}% complete</strong><span>{onboarding.progress.completedSteps} of {onboarding.progress.totalSteps} sections ready</span></div>
        <progress max={100} value={onboarding.progress.percentage}>{onboarding.progress.percentage}%</progress>
      </section>

      <div className="onboarding-sections">
        <details id="personal" className="onboarding-card" open={!onboarding.personal?.phone || !onboarding.driver?.preferred_area}>
          <summary>1 · Personal details <span className="muted">{onboarding.personal?.phone && onboarding.driver?.preferred_area ? 'Saved' : 'Needs information'}</span></summary>
          <div className="section-number">1</div><div className="section-copy"><h2>Personal details</h2><p>Add your phone number and the area where you want to drive.</p></div>
          <form action={savePersonalDetails} className="form-stack">
            <fieldset disabled={!editable}>
              <div className="form-grid"><label>First name<input disabled value={onboarding.personal?.first_name ?? ''} /></label><label>Last name<input disabled value={onboarding.personal?.last_name ?? ''} /></label></div>
              <label>Phone number<input autoComplete="tel" defaultValue={onboarding.personal?.phone ?? ''} maxLength={30} name="phone" placeholder="09XX XXX XXXX" required type="tel" /></label>
              <label>Preferred service area<input defaultValue={onboarding.driver?.preferred_area ?? ''} maxLength={120} name="preferredArea" placeholder="e.g. Metro Manila" required /></label>
              <SubmitButton pendingLabel="Saving…">Save personal details</SubmitButton>
            </fieldset>
          </form>
        </details>

        <details id="vehicle" className="onboarding-card" open={!onboarding.vehicle}>
          <summary>2 · Primary vehicle <span className="muted">{onboarding.vehicle ? 'Saved' : 'Add your vehicle'}</span></summary>
          <div className="section-number">2</div><div className="section-copy"><h2>Primary vehicle</h2><p>Tell us about the vehicle you will use. Our team reviews it with your documents.</p></div>
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
        </details>

        <details id="documents" className="onboarding-card onboarding-card-wide" open={!onboarding.progress.canSubmit || status === 'rejected'}>
          <summary>3 · Documents <span className="muted">Driver’s license and vehicle registration required</span></summary>
          <div className="section-number">3</div><div className="section-copy"><h2>Private documents</h2><p>PDF, JPG, or PNG up to 5 MB. Files are stored privately and are not publicly accessible.</p></div>
          <div className="document-columns">
            <div><h3>Driver documents</h3><DocumentList documents={onboarding.driverDocuments} replacementHref={editable ? '#driver-document-upload' : undefined} />
              <form id="driver-document-upload" action={uploadDriverDocument} className="upload-form"><fieldset disabled={!editable || !onboarding.driver}>
                <label>Document type<select name="documentType"><option value="drivers_license">Driver&apos;s license (required)</option><option value="professional_license">Professional license</option><option value="nbi_clearance">NBI clearance</option><option value="medical_certificate">Medical certificate</option></select></label>
                <label>Expiration date<input min={today} name="expiresOn" type="date" /></label><label>Choose file<input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" name="file" required type="file" /></label>
                <SubmitButton pendingLabel="Uploading…">Upload driver document</SubmitButton>
              </fieldset></form>
            </div>
            <div><h3>Vehicle documents</h3><DocumentList documents={onboarding.vehicleDocuments} replacementHref={editable ? '#vehicle-document-upload' : undefined} />
              <form id="vehicle-document-upload" action={uploadVehicleDocument} className="upload-form"><fieldset disabled={!editable || !onboarding.vehicle}>
                <input name="vehicleId" type="hidden" value={onboarding.vehicle?.id ?? ''} />
                <label>Document type<select name="documentType"><option value="registration">Registration (required)</option><option value="insurance">Insurance</option><option value="franchise">Franchise document</option><option value="inspection_certificate">Inspection certificate</option></select></label>
                <label>Expiration date<input min={today} name="expiresOn" type="date" /></label><label>Choose file<input accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" name="file" required type="file" /></label>
                <SubmitButton pendingLabel="Uploading…">Upload vehicle document</SubmitButton>
              </fieldset></form>
            </div>
          </div>
        </details>
      </div>

      {!onboarding.progress.canSubmit && <p className="notice">Complete your phone and service area, save your vehicle, then upload a current driver’s license and vehicle registration to submit.</p>}
      <section id="review" className="submit-card"><div><h2>{editable ? 'Review and submit' : 'Application status'}</h2><p>Our team will review your details and documents. We’ll show the result here, including anything that needs updating.</p></div>{editable && <form action={submitOnboarding}><SubmitButton disabled={!onboarding.progress.canSubmit || missingItems.length > 0} pendingLabel="Submitting…">Submit application</SubmitButton></form>}</section>
    </div>
  );
}
