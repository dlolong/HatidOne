import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Row,
  StatusPill,
  LoadingSkeleton,
  userError,
  Field,
  Heading,
  Muted,
  Notice,
  Screen,
  useAuth,
  useResource,
} from "@hatidone/mobile";
interface Contact {
  id: string;
  name: string;
  phone: string;
}
export default function Account() {
  const auth = useAuth();
  const [section, setSection] = useState("profile");
  const [addingContact, setAddingContact] = useState(false);
  const [firstName, setFirstName] = useState(auth.profile?.first_name ?? "");
  const [lastName, setLastName] = useState(auth.profile?.last_name ?? "");
  const [phone, setPhone] = useState(auth.profile?.phone ?? "");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const contacts = useResource(async () => {
    if (!auth.client || !auth.session) return [];
    const result = await auth.client
      .from("emergency_contacts")
      .select("id,name,phone")
      .eq("user_id", auth.session.user.id)
      .order("created_at");
    if (result.error) throw new Error(result.error.message);
    return result.data as Contact[];
  }, [auth.client, auth.session?.user.id]);
  useEffect(() => {
    setFirstName(auth.profile?.first_name ?? "");
    setLastName(auth.profile?.last_name ?? "");
    setPhone(auth.profile?.phone ?? "");
  }, [auth.profile]);
  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
    } catch (reason) {
      setError(
        userError(
          reason,
          "We couldn’t save your changes. Check the details and try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile() {
    if (!auth.client || !auth.session) return;
    if (!firstName.trim()) throw new Error("Enter your first name.");
    const result = await auth.client
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      })
      .eq("id", auth.session.user.id);
    if (result.error) throw new Error(result.error.message);
    await auth.refreshProfile();
  }
  async function addContact() {
    if (!auth.client) return;
    const result = await auth.client.rpc("save_emergency_contact", {
      p_name: contactName.trim(),
      p_phone: contactPhone.trim(),
    });
    if (result.error) throw new Error(result.error.message);
    setContactName("");
    setContactPhone("");
    setAddingContact(false);
    await contacts.reload();
  }
  async function removeContact(id: string) {
    if (!auth.client) return;
    const result = await auth.client.rpc("delete_emergency_contact", {
      p_contact_id: id,
    });
    if (result.error) throw new Error(result.error.message);
    setDeleting(null);
    await contacts.reload();
  }
  return (
    <Screen scrollKey={section}>
      <Heading>Your account</Heading>
      <Row>
        {[
          ["profile", "Profile"],
          ["contacts", "Emergency contacts"],
        ].map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={section === value}
            onPress={() => setSection(value)}
          />
        ))}
      </Row>
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}
      {section === "profile" && (
        <>
          <Card>
            <Heading size="section">
              {auth.profile?.first_name} {auth.profile?.last_name}
            </Heading>
            <Muted>{auth.session?.user.email}</Muted>
            <StatusPill
              tone={auth.profile?.phone_verified ? "success" : "neutral"}
              label={
                auth.profile?.phone_verified
                  ? "Phone verified"
                  : "Phone not verified"
              }
            />

            <Field
              label="First name"
              autoComplete="given-name"
              textContentType="givenName"
              value={firstName}
              onChangeText={setFirstName}
              maxLength={100}
            />
            <Field
              label="Last name (optional)"
              autoComplete="family-name"
              textContentType="familyName"
              value={lastName}
              onChangeText={setLastName}
              maxLength={100}
            />
            <Field
              label="Phone (optional)"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={30}
            />
            <Button
              label="Save profile"
              disabled={!firstName.trim()}
              loading={busy}
              onPress={() => void run(saveProfile, "Profile saved.")}
            />
          </Card>
          <Button
            label="View your trip activity"
            variant="secondary"
            onPress={() => router.push("/(tabs)/bookings")}
          />
        </>
      )}
      {section === "contacts" && (
        <Card>
          <Heading size="section">People you trust</Heading>
          <Muted>
            Keep their details handy. Adding a contact does not send alerts or
            share your location.
          </Muted>
          {contacts.error && (
            <>
              <Notice tone="error">We couldn’t load your contacts.</Notice>
              <Button
                label="Retry contacts"
                variant="secondary"
                onPress={() => void contacts.reload()}
              />
            </>
          )}
          {contacts.loading && !contacts.data && <LoadingSkeleton lines={3} />}
          {contacts.data?.length === 0 && <Muted>No contacts saved yet.</Muted>}
          {contacts.data?.map((contact) => (
            <View key={contact.id} style={{ gap: 12 }}>
              <Muted>
                {contact.name} · {contact.phone}
              </Muted>
              {deleting === contact.id ? (
                <>
                  <Notice>Remove this emergency contact?</Notice>
                  <Button
                    label="Confirm remove"
                    variant="danger"
                    disabled={busy}
                    onPress={() =>
                      void run(
                        () => removeContact(contact.id),
                        "Emergency contact removed.",
                      )
                    }
                  />
                  <Button
                    label="Keep contact"
                    variant="secondary"
                    onPress={() => setDeleting(null)}
                  />
                </>
              ) : (
                <Button
                  label={`Remove ${contact.name}`}
                  variant="secondary"
                  onPress={() => setDeleting(contact.id)}
                />
              )}
            </View>
          ))}
          <Button
            label={
              addingContact ? "Close contact form" : "Add emergency contact"
            }
            variant="secondary"
            onPress={() => setAddingContact(!addingContact)}
          />
          {addingContact && (
            <>
              <Field
                label="Contact name"
                value={contactName}
                onChangeText={setContactName}
                maxLength={120}
              />
              <Field
                label="Contact phone"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                maxLength={30}
              />
              <Button
                label="Save emergency contact"
                loading={busy}
                disabled={!contactName.trim() || !contactPhone.trim()}
                onPress={() => void run(addContact, "Emergency contact saved.")}
              />
            </>
          )}
        </Card>
      )}
      <Button
        label="Sign out"
        variant="secondary"
        loading={busy}
        onPress={() => void run(auth.signOut, "")}
      />
    </Screen>
  );
}
