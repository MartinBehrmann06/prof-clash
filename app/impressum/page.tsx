import type { Metadata } from 'next';
import { LEGAL_DATE, OPERATOR } from '@/lib/legal';
import { MIN_DUELS } from '@/lib/game';

export const metadata: Metadata = { title: 'Impressum · Prof Clash' };

export default function ImpressumPage() {
  const mail = OPERATOR.email;
  return (
    <div className="page">
      <header className="head"><h1>Impressum</h1></header>
      <article className="panel prose">
        <h2>Betreiber</h2>
        <p>
          {OPERATOR.name || 'Studierendenprojekt (Angaben folgen)'}
          {OPERATOR.place && <><br />{OPERATOR.place}</>}
          <br />Kontakt: {mail ? <a href={`mailto:${mail}`}>{mail}</a> : 'folgt'}
        </p>
        <p>
          Prof Clash ist ein unabhängiges, nicht kommerzielles Projekt von Studierenden. Es wird weder von der ETH Zürich
          betrieben noch von ihr unterstützt. „ETH Zürich“ wird nur verwendet, um zu beschreiben, um welche Hochschule es geht.
          Es gibt keine Verbindung zu Supercell oder deren Spielen.
        </p>

        <h2>Was die Rangliste ist — und was nicht</h2>
        <p>
          Eingeloggte Studierende beantworten immer wieder dieselbe Frage: <i>„Wessen Vorlesung würdest du lieber besuchen?“</i>{' '}
          Aus diesen persönlichen Vorlieben entsteht eine Elo-Wertung. Sie ist eine Sammlung von Meinungen, keine Bewertung
          der fachlichen oder didaktischen Qualität und keine Tatsachenbehauptung über eine Person.
        </p>
        <ul>
          <li>Es gibt keine Kommentare oder Freitexte, nur die Wahl zwischen zwei Personen.</li>
          <li>Abstimmen kann nur, wer sich mit einer ETH-Adresse anmeldet, und nur über Dozierende aus den eigenen Pflichtfächern. Jede Paarung zählt pro Person einmal.</li>
          <li>Einen Rang erhält eine Person erst ab {MIN_DUELS} gezählten Duellen. Wenige Stimmen sind Zufall, kein Urteil.</li>
          <li>Es werden keine Fotos verwendet. Alle Figuren sind gezeichnet und zeigen niemanden ab.</li>
          <li>Die Angaben zu Lehrveranstaltungen stammen aus dem öffentlichen Vorlesungsverzeichnis der ETH und können veraltet oder unvollständig sein.</li>
        </ul>

        <h2 id="entfernen">Eintrag entfernen lassen</h2>
        <p>
          Sie sind Dozentin oder Dozent und möchten nicht auf Prof Clash erscheinen? Schreiben Sie uns
          {mail ? <> an <a href={`mailto:${mail}?subject=Prof%20Clash%20%E2%80%93%20Eintrag%20entfernen`}>{mail}</a></> : ' über die oben genannte Kontaktadresse'}.
          Eine Begründung ist nicht nötig. Wir blenden Ihren Eintrag in der Regel innerhalb weniger Tage vollständig aus:
          aus Ranglisten, Duellen, Studierendenlisten und der Profilseite. Er erscheint auch nach einer Aktualisierung der Daten nicht wieder.
        </p>
        <p>Für Hinweise auf falsche Angaben gilt dieselbe Adresse.</p>

        <p className="stamp">Stand: {LEGAL_DATE} · <a href="/datenschutz">Datenschutzerklärung</a></p>
      </article>
    </div>
  );
}
