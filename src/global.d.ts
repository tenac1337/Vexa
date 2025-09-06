// src/global.d.ts
declare global {
    interface Window {
      gapi: any; // Google API Client Library
      google: any; // Google Identity Services
      // Specific onload handlers if you named them uniquely per service,
      // or a generic one if you load all APIs together.
      // For this combined approach, the existing gapiLoadedForCalendar/gisLoadedForCalendar
      // will be adapted to load both Calendar and Gmail.
      gapiLoadedForGoogleServices?: () => void;
      gisLoadedForGoogleServices?: () => void;
    }
  }
  export {};