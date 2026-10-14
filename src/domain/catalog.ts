import type { Category, CategoryId, Question, QuestionId } from "./types";

// Ported from the crat-demo prototype. Order defines the interview order.
export const catalog: readonly Category[] = [
  {
    id: "cyber-risk-management",
    name: { en: "Cyber Risk Management", de: "Cyber-Risikomanagement" },
    questions: [
      {
        id: "crm_001",
        text: {
          en: "How does your organization identify and assess cyber risks?",
          de: "Wie identifiziert und bewertet Ihre Organisation Cyber-Risiken?",
        },
        context: {
          en: "Looking for formal risk assessment methodology",
          de: "Erwartet wird eine formale Methodik zur Risikobewertung",
        },
      },
      {
        id: "crm_002",
        text: {
          en: "What is your process for prioritizing identified cyber risks?",
          de: "Wie priorisieren Sie identifizierte Cyber-Risiken?",
        },
        context: {
          en: "Looking for risk ranking criteria and decision-making process",
          de: "Erwartet werden Kriterien zur Risikoeinstufung und ein Entscheidungsprozess",
        },
      },
      {
        id: "crm_003",
        text: {
          en: "How often do you conduct cyber risk assessments?",
          de: "Wie oft führen Sie Cyber-Risikobewertungen durch?",
        },
        context: {
          en: "Looking for regular assessment schedule and triggers for ad-hoc assessments",
          de: "Erwartet werden ein regelmäßiger Bewertungsrhythmus und Auslöser für anlassbezogene Bewertungen",
        },
      },
      {
        id: "crm_004",
        text: {
          en: "Who is responsible for cyber risk management in your organization?",
          de: "Wer ist in Ihrer Organisation für das Cyber-Risikomanagement verantwortlich?",
        },
        context: {
          en: "Looking for clear ownership and accountability structure",
          de: "Erwartet werden klare Zuständigkeiten und Verantwortlichkeiten",
        },
      },
      {
        id: "crm_005",
        text: {
          en: "How do you communicate cyber risks to executive leadership and the board?",
          de: "Wie kommunizieren Sie Cyber-Risiken an die Geschäftsführung und den Aufsichtsrat?",
        },
        context: {
          en: "Looking for reporting mechanisms and frequency",
          de: "Erwartet werden Berichtswege und deren Häufigkeit",
        },
      },
    ],
  },
  {
    id: "access-control",
    name: { en: "Access Control", de: "Zugriffskontrolle" },
    questions: [
      {
        id: "ac_001",
        text: {
          en: "How do you manage user access provisioning and de-provisioning?",
          de: "Wie verwalten Sie die Vergabe und den Entzug von Benutzerzugängen?",
        },
        context: {
          en: "Looking for formal access management processes",
          de: "Erwartet werden formale Prozesse für das Zugriffsmanagement",
        },
      },
      {
        id: "ac_002",
        text: {
          en: "What authentication mechanisms are in place for critical systems?",
          de: "Welche Authentifizierungsverfahren setzen Sie für kritische Systeme ein?",
        },
        context: {
          en: "Looking for MFA, SSO, and strong authentication practices",
          de: "Erwartet werden MFA, SSO und starke Authentifizierungsverfahren",
        },
      },
      {
        id: "ac_003",
        text: {
          en: "How do you handle privileged access management?",
          de: "Wie gehen Sie mit privilegierten Zugängen um?",
        },
        context: {
          en: "Looking for PAM tools, monitoring, and controls",
          de: "Erwartet werden PAM-Werkzeuge, Überwachung und Kontrollen",
        },
      },
      {
        id: "ac_004",
        text: {
          en: "How often do you review user access rights?",
          de: "Wie oft überprüfen Sie Benutzerberechtigungen?",
        },
        context: {
          en: "Looking for regular access reviews and certification processes",
          de: "Erwartet werden regelmäßige Berechtigungsprüfungen und Rezertifizierungsprozesse",
        },
      },
      {
        id: "ac_005",
        text: {
          en: "What is your password policy and how is it enforced?",
          de: "Wie lautet Ihre Passwortrichtlinie und wie wird sie durchgesetzt?",
        },
        context: {
          en: "Looking for password complexity, rotation, and technical enforcement",
          de: "Erwartet werden Anforderungen an Komplexität, Wechsel und technische Durchsetzung",
        },
      },
    ],
  },
  {
    id: "incident-response",
    name: { en: "Incident Response", de: "Incident Response" },
    questions: [
      {
        id: "ir_001",
        text: {
          en: "Do you have a documented incident response plan?",
          de: "Haben Sie einen dokumentierten Incident-Response-Plan?",
        },
        context: {
          en: "Looking for formal IR plan with defined procedures",
          de: "Erwartet wird ein formaler IR-Plan mit definierten Abläufen",
        },
      },
      {
        id: "ir_002",
        text: {
          en: "How do you detect and classify security incidents?",
          de: "Wie erkennen und klassifizieren Sie Sicherheitsvorfälle?",
        },
        context: {
          en: "Looking for detection capabilities and severity classification",
          de: "Erwartet werden Erkennungsfähigkeiten und eine Schweregrad-Klassifizierung",
        },
      },
      {
        id: "ir_003",
        text: {
          en: "What is your incident escalation process?",
          de: "Wie sieht Ihr Eskalationsprozess bei Vorfällen aus?",
        },
        context: {
          en: "Looking for clear escalation paths and communication procedures",
          de: "Erwartet werden klare Eskalationswege und Kommunikationsabläufe",
        },
      },
      {
        id: "ir_004",
        text: {
          en: "How do you conduct post-incident reviews?",
          de: "Wie führen Sie Nachbetrachtungen nach Vorfällen durch?",
        },
        context: {
          en: "Looking for lessons learned process and continuous improvement",
          de: "Erwartet werden ein Lessons-Learned-Prozess und kontinuierliche Verbesserung",
        },
      },
      {
        id: "ir_005",
        text: {
          en: "How often do you test your incident response capabilities?",
          de: "Wie oft testen Sie Ihre Fähigkeiten zur Reaktion auf Vorfälle?",
        },
        context: {
          en: "Looking for tabletop exercises, simulations, and drills",
          de: "Erwartet werden Planspiele, Simulationen und Übungen",
        },
      },
    ],
  },
  {
    id: "data-protection",
    name: { en: "Data Protection", de: "Datenschutz" },
    questions: [
      {
        id: "dp_001",
        text: {
          en: "How do you classify and inventory sensitive data?",
          de: "Wie klassifizieren und inventarisieren Sie sensible Daten?",
        },
        context: {
          en: "Looking for data classification scheme and asset inventory",
          de: "Erwartet werden ein Klassifizierungsschema und ein Bestandsverzeichnis",
        },
      },
      {
        id: "dp_002",
        text: {
          en: "What encryption is used for data at rest and in transit?",
          de: "Welche Verschlüsselung setzen Sie für gespeicherte und übertragene Daten ein?",
        },
        context: {
          en: "Looking for encryption standards and key management",
          de: "Erwartet werden Verschlüsselungsstandards und Schlüsselverwaltung",
        },
      },
      {
        id: "dp_003",
        text: {
          en: "How do you handle data retention and secure disposal?",
          de: "Wie regeln Sie Aufbewahrung und sichere Löschung von Daten?",
        },
        context: {
          en: "Looking for retention policies and secure deletion procedures",
          de: "Erwartet werden Aufbewahrungsrichtlinien und Verfahren zur sicheren Löschung",
        },
      },
      {
        id: "dp_004",
        text: {
          en: "What data loss prevention controls are in place?",
          de: "Welche Maßnahmen zur Verhinderung von Datenabfluss (DLP) setzen Sie ein?",
        },
        context: {
          en: "Looking for DLP tools and monitoring capabilities",
          de: "Erwartet werden DLP-Werkzeuge und Überwachungsmöglichkeiten",
        },
      },
      {
        id: "dp_005",
        text: {
          en: "How do you manage third-party access to sensitive data?",
          de: "Wie steuern Sie den Zugriff Dritter auf sensible Daten?",
        },
        context: {
          en: "Looking for vendor management and data sharing agreements",
          de: "Erwartet werden Lieferantenmanagement und Vereinbarungen zur Datenweitergabe",
        },
      },
    ],
  },
  {
    id: "security-awareness",
    name: { en: "Security Awareness", de: "Sicherheitsbewusstsein" },
    questions: [
      {
        id: "sa_001",
        text: {
          en: "What security awareness training do you provide to employees?",
          de: "Welche Security-Awareness-Schulungen bieten Sie Ihren Mitarbeitenden an?",
        },
        context: {
          en: "Looking for training program content and delivery method",
          de: "Erwartet werden Inhalte des Schulungsprogramms und die Art der Durchführung",
        },
      },
      {
        id: "sa_002",
        text: {
          en: "How often is security awareness training conducted?",
          de: "Wie oft finden Security-Awareness-Schulungen statt?",
        },
        context: {
          en: "Looking for training frequency and completion tracking",
          de: "Erwartet werden Schulungshäufigkeit und Nachverfolgung der Teilnahme",
        },
      },
      {
        id: "sa_003",
        text: {
          en: "Do you conduct phishing simulations?",
          de: "Führen Sie Phishing-Simulationen durch?",
        },
        context: {
          en: "Looking for phishing testing program and metrics",
          de: "Erwartet werden ein Phishing-Testprogramm und Kennzahlen",
        },
      },
      {
        id: "sa_004",
        text: {
          en: "How do you measure the effectiveness of security awareness programs?",
          de: "Wie messen Sie die Wirksamkeit Ihrer Security-Awareness-Programme?",
        },
        context: {
          en: "Looking for metrics, KPIs, and improvement tracking",
          de: "Erwartet werden Kennzahlen, KPIs und die Nachverfolgung von Verbesserungen",
        },
      },
      {
        id: "sa_005",
        text: {
          en: "What role-specific security training is provided?",
          de: "Welche rollenspezifischen Sicherheitsschulungen bieten Sie an?",
        },
        context: {
          en: "Looking for specialized training for IT, developers, executives",
          de: "Erwartet werden spezielle Schulungen für IT, Entwicklung und Führungskräfte",
        },
      },
    ],
  },
];

export function getCategory(id: CategoryId): Category | undefined {
  return catalog.find((category) => category.id === id);
}

export function getQuestion(id: QuestionId): Question | undefined {
  for (const category of catalog) {
    const question = category.questions.find((q) => q.id === id);
    if (question) return question;
  }
  return undefined;
}

export function getCategoryOfQuestion(id: QuestionId): Category | undefined {
  return catalog.find((category) =>
    category.questions.some((question) => question.id === id),
  );
}
