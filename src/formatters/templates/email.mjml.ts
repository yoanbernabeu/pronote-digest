/** Gabarit MJML rendu par Eta. Les variables sont dans `it` (DigestView). */
export const EMAIL_TEMPLATE = `<mjml>
  <mj-head>
    <mj-title><%= it.title %></mj-title>
    <mj-preview><%= it.title %></mj-preview>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text font-size="15px" line-height="1.5" color="#1f2933" />
      <mj-section padding="0 16px" />
    </mj-attributes>
    <mj-style>
      .lesson-cancelled { color: #9aa5b1; text-decoration: line-through; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
      .badge-warn { background: #fff3cd; color: #7a5b00; }
      .badge-info { background: #e3f2fd; color: #0b4f8a; }
      td.time { white-space: nowrap; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f6f8">
    <mj-section padding="24px 16px 8px">
      <mj-column>
        <mj-text font-size="22px" font-weight="bold"><%= it.title %></mj-text>
      </mj-column>
    </mj-section>
<% if (it.intro) { %>
    <mj-section background-color="#ffffff" border-radius="8px" padding="8px 16px">
      <mj-column>
        <mj-text font-style="italic"><%= it.intro %></mj-text>
      </mj-column>
    </mj-section>
<% } %>
<% if (!it.schoolDay) { %>
    <mj-section background-color="#ffffff" border-radius="8px" padding="8px 16px">
      <mj-column>
        <mj-text font-size="17px" font-weight="bold">Pas de cours le <%= it.targetDate %></mj-text>
<% if (it.holiday) { %>
        <mj-text><%= it.holiday %>.</mj-text>
<% } %>
<% if (it.nextSchoolDay) { %>
        <mj-text>Reprise le <%= it.nextSchoolDay %>.</mj-text>
<% } %>
      </mj-column>
    </mj-section>
<% } %>
<% for (const child of it.children) { %>
    <mj-section background-color="#ffffff" border-radius="8px" padding="8px 16px 16px">
      <mj-column>
        <mj-text font-size="19px" font-weight="bold" padding-bottom="4px"><%= child.name %></mj-text>
<% if (it.kind === 'planning') { %>
<% if (child.noSchool) { %>
        <mj-text>Pas de cours<% if (child.holiday) { %> (<%= child.holiday %>)<% } %>.</mj-text>
<% } else { %>
        <mj-text padding-top="0" padding-bottom="8px">
          <span class="badge badge-info">Journée <%= child.firstStart %> – <%= child.lastEnd %></span>
<% if (child.hasSport) { %>
          <span class="badge badge-warn">EPS : tenue de sport</span>
<% } %>
        </mj-text>
        <mj-table font-size="14px" cellpadding="6px">
          <tr style="border-bottom: 1px solid #e4e7eb; text-align: left;">
            <th>Heure</th><th>Matière</th><th>Enseignant</th><th>Salle</th>
          </tr>
<% for (const lesson of child.lessons) { %>
          <tr<% if (lesson.status === 'cancelled') { %> class="lesson-cancelled"<% } %>>
            <td class="time"><%= lesson.time %></td>
            <td><%= lesson.subject %><% if (lesson.statusLabel) { %> <strong>(<%= lesson.statusLabel %>)</strong><% } %></td>
            <td><%= lesson.teachers %></td>
            <td><%= lesson.rooms %></td>
          </tr>
<% } %>
        </mj-table>
<% } %>
<% } else { %>
<% if (child.homework.length === 0) { %>
        <mj-text>Aucun devoir saisi pour ce jour.</mj-text>
<% } else { %>
<% for (const hw of child.homework) { %>
        <mj-text padding-bottom="4px">
          <strong><%= hw.subject %></strong> <span style="color:#616e7c;">· <%= hw.teachers %> · donné le <%= hw.assignedOn %></span>
        </mj-text>
        <mj-text padding-top="0" padding-bottom="14px"><%~ hw.html %></mj-text>
<% } %>
<% } %>
<% } %>
      </mj-column>
    </mj-section>
<% } %>
    <mj-section padding="16px">
      <mj-column>
        <mj-text font-size="12px" color="#7b8794" align="center">
          Généré par pronote-digest à partir du flux iCal Pronote. Vérifiez sur Pronote en cas de doute.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
