import type { Metadata } from 'next';
import { LEGAL_DATE, OPERATOR, RETENTION_MONTHS } from '@/lib/legal';
import { DeleteAccount } from '@/components/DeleteAccount';

export const metadata: Metadata = { title: 'Datenschutz · Prof Clash' };

export default function DatenschutzPage() {
  const mail = OPERATOR.email;
  const contact = mail ? <a href={`mailto:${mail}`}>{mail}</a> : 'die Kontaktadresse im Impressum';
  return (
    <div className="page">
      <header className="head"><h1>Datenschutz</h1>
        <p>Kurz gesagt: so wenig Daten wie möglich, kein Tracking, keine Werbung, keine Fotos.</p></header>
      <article className="panel prose">
        <h2>Verantwortlich</h2>
        <p>{OPERATOR.name || 'Der Betreiber laut Impressum'}{OPERATOR.place ? `, ${OPERATOR.place}` : ''}. Kontakt: {contact}. Diese Erklärung richtet sich nach dem Schweizer Datenschutzgesetz (DSG).</p>

        <h2>Wenn du dich anmeldest (Studierende)</h2>
        <ul>
          <li><b>ETH-E-Mail-Adresse</b>: für die Anmeldung mit Passwort, bestätigt per 6-stelligem Code. Daraus leiten wir deinen ETH-Benutzernamen ab, damit name@ethz.ch und name@student.ethz.ch dasselbe Konto sind.</li>
          <li><b>Passwort</b>: nur als Hash bei Supabase gespeichert, wir sehen es nie im Klartext.</li>
          <li><b>Studiengang, Semester und Studienbeginn</b>: um die Dozierenden deiner Pflichtfächer aus den richtigen Semestern zu finden.</li>
          <li><b>Deine Auswahl an Dozierenden und deine Stimmen</b> (welche Paarung, wer gewählt wurde, wann, aus welchem Department) sowie deine Spielpunkte (XP).</li>
          <li><b>Deine Befehle in der Weekend League</b>: welche Truppen du in welcher Woche zu welchem Gebäude schickst.</li>
        </ul>
        <p>
          Wozu: Login, Ermitteln der Wertung, Missbrauchsschutz (ein Konto pro Person, eine Stimme pro Paarung).
          Öffentlich sichtbar sind nur zusammengefasste Wertungen pro Professor:in. Wer wie abgestimmt hat, ist nirgends sichtbar
          und wird nicht weitergegeben.
        </p>

        <h2>Ohne Anmeldung (Training)</h2>
        <p>Im Training wird nichts an uns gesendet oder gespeichert. Nur ein Zähler deiner Trainingsrunden liegt lokal in deinem Browser.</p>

        <h2>Angaben zu Dozierenden</h2>
        <p>
          Wir verwenden Name, Titel, Funktion, Department, Fachgebiet, den Link zur eigenen Webseite und die Lehrveranstaltungen.
          Diese Angaben stammen aus dem öffentlich zugänglichen Vorlesungsverzeichnis der ETH Zürich. Dazu kommt die aus den
          Stimmen berechnete Wertung. Wir verwenden keine Fotos und keine Freitexte. Dozierende können jederzeit
          verlangen, dass ihr Eintrag ausgeblendet wird (<a href="/impressum#entfernen">so geht’s</a>).
        </p>

        <h2>Dienstleister</h2>
        <p>Wir nutzen folgende Anbieter, die Daten in unserem Auftrag bearbeiten:</p>
        <ul>
          <li><b>Supabase</b>: Datenbank und Login; Server in der EU (Irland).</li>
          <li><b>Brevo</b> (Sendinblue SAS, Frankreich): Versand der Bestätigungs- und Login-Codes per E-Mail.</li>
          <li><b>Vercel</b> (USA): Hosting der Website. Beim Aufruf werden technisch nötige Verbindungsdaten wie die IP-Adresse kurz verarbeitet. Die Übermittlung in die USA stützt sich auf das Swiss-U.S. Data Privacy Framework bzw. Standardvertragsklauseln. Ausserdem zählt Vercel Web Analytics anonym, welche Seiten aufgerufen werden (Seite, Herkunftsseite, Land, Gerätetyp), ohne Cookies und ohne dich über mehrere Tage wiederzuerkennen, und Vercel Speed Insights misst ebenso anonym, wie schnell die Seiten laden.</li>
          <li><b>Cloudflare</b>: Verwaltung der Domain (DNS).</li>
        </ul>

        <h2>Cookies und Browser-Speicher</h2>
        <p>Wir verwenden keine Tracking- oder Werbe-Cookies. Besuchsstatistik und Ladezeit-Messung von Vercel (siehe oben) kommen ohne Cookies aus. Im Browser-Speicher liegen nur die Login-Sitzung (falls angemeldet) und der Trainingszähler.</p>

        <h2>Wie lange</h2>
        <p>
          Dein Konto bleibt bestehen, bis du es löschst oder es {RETENTION_MONTHS} Monate lang nicht benutzt wurde (kein Login, keine Stimme,
          kein Befehl in der Weekend League). Dann löschen wir automatisch dein Konto, dein Profil, deine Stimmen und deine Befehle.
          Bereits berechnete Wertungen werden nicht rückwirkend neu berechnet, enthalten aber keinen Bezug mehr zu dir.
        </p>
        <DeleteAccount />

        <h2>Deine Rechte</h2>
        <p>
          Du kannst Auskunft über deine Daten verlangen sowie deren Berichtigung oder Löschung, und du kannst der Bearbeitung
          widersprechen. Schreib dazu an {contact}. Du hast ausserdem das Recht, dich beim Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten (EDÖB) zu beschweren.
        </p>

        <p className="stamp">Stand: {LEGAL_DATE} · <a href="/impressum">Impressum</a></p>
      </article>
    </div>
  );
}
