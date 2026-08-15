import { Type, type FunctionDeclaration } from "@google/genai";

/**
 * Gemini-facing tool schema. This is the ONLY interface Gemini has into
 * the booking system — every name here must have a matching, safe handler
 * in lib/agent/toolRunner.ts's AGENT_TOOL_REGISTRY. Deliberately excludes
 * confirmReservation, sendConfirmationEmail, deleteReservation, and any
 * other admin-only operation (AGENTS spec §9) — those exist in the
 * codebase for the admin dashboard, not for this declaration list.
 */
export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "getServices",
    description:
      "Returns every currently bookable Woori Aroma treatment option (name, description, duration, price per person). Always call this before quoting a price or duration, or before calling getAvailability/calculatePrice/createReservationRequest, since serviceOptionId values come from here.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getAvailability",
    description:
      "Returns the real bookable time slots for one treatment option on one date, already accounting for prep/cleanup buffers and existing bookings. Never guess whether a time is available — always call this.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: "Date in YYYY-MM-DD format, Asia/Seoul." },
        serviceOptionId: {
          type: Type.STRING,
          description: "A serviceOptionId returned by getServices, e.g. \"aroma-oil-90\".",
        },
        partySize: {
          type: Type.INTEGER,
          description: "Number of guests in the group, 1-4. Woori Aroma books the whole slot for one private group regardless of size.",
        },
      },
      required: ["date", "serviceOptionId", "partySize"],
    },
  },
  {
    name: "calculatePrice",
    description:
      "Returns the official price for a treatment option and guest count. Never compute or estimate a price yourself.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        serviceOptionId: { type: Type.STRING, description: "A serviceOptionId returned by getServices." },
        partySize: { type: Type.INTEGER, description: "Number of guests, 1-4." },
      },
      required: ["serviceOptionId", "partySize"],
    },
  },
  {
    name: "createReservationRequest",
    description:
      "Submits a PENDING reservation request after the customer has explicitly confirmed the full booking summary in this conversation. Never call this without an explicit prior confirmation from the customer. This never creates a CONFIRMED reservation and never collects payment — Woori Aroma has no deposit or online payment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        serviceOptionId: { type: Type.STRING, description: "A serviceOptionId returned by getServices." },
        partySize: { type: Type.INTEGER, description: "Number of guests, 1-4." },
        date: { type: Type.STRING, description: "Date in YYYY-MM-DD format, Asia/Seoul." },
        time: { type: Type.STRING, description: "Start time in HH:mm 24-hour format, Asia/Seoul." },
        customerName: { type: Type.STRING, description: "The customer's full name." },
        email: { type: Type.STRING, description: "The customer's email address." },
        phoneOrWhatsapp: { type: Type.STRING, description: "The customer's phone or WhatsApp number, with country code." },
        specialRequest: { type: Type.STRING, description: "Any special request the customer mentioned, if any." },
      },
      required: ["serviceOptionId", "partySize", "date", "time", "customerName", "email", "phoneOrWhatsapp"],
    },
  },
  {
    name: "getReservationStatus",
    description:
      "Looks up an existing reservation's status by reservation number, but ONLY returns it if the provided email or phone matches the reservation's customer. Use this only when the customer both gives a reservation number AND provides their email or phone for verification. Never reveal another customer's reservation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reservationNumber: { type: Type.STRING, description: "e.g. \"WA-20260812-001\"." },
        email: { type: Type.STRING, description: "Email on file for the reservation, if the customer provided it." },
        phone: { type: Type.STRING, description: "Phone on file for the reservation, if the customer provided it." },
      },
      required: ["reservationNumber"],
    },
  },
  {
    name: "handoffToAdmin",
    description:
      "Hands off the conversation to Woori Aroma staff for anything you cannot resolve yourself: 5+ guests, changing/cancelling a reservation, a special or custom request, an unclear price/policy question, a booking conflict, or any situation you are not confident about. Always tell the customer a staff member will follow up after calling this.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: "Short machine-readable reason, e.g. \"5+ guests\"." },
        summary: { type: Type.STRING, description: "A short summary of what the customer needs, in English, for staff to read." },
        customerContact: { type: Type.STRING, description: "Email or phone to reach the customer back, if known." },
      },
      required: ["reason", "summary"],
    },
  },
];
