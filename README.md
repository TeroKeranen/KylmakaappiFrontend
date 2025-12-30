# Cold Pack Vending Machine – React Native App

##  Overview
This project is a **React Native (Expo) mobile application** designed to control and monitor a **cold pack vending machine** located inside a freezer.  
The application communicates with embedded devices (ESP32) and a backend service to enable **remote control, device provisioning, and real-time status monitoring**.

The goal of the project is to create a **scalable IoT-based vending solution** that can be managed remotely via a mobile app.

---
<img src="./assets/screenshots/1.jpg" width="250" />

##  Project Purpose
The application allows users to:
- Connect the vending machine to a Wi-Fi network
- Control motors and mechanisms inside the freezer
- Monitor device status and sensors
- Send commands to the machine securely
- Support future expansion for multiple devices and locations

This project is part of a larger system that combines **hardware, firmware, backend services, and a mobile application**.

---

##  Tech Stack

### Mobile App
- React Native
- Expo
- TypeScript / JavaScript
- Axios / Fetch API
- React Navigation

### Embedded Devices
- ESP32 (Wi-Fi & BLE)
- Stepper motors
- Sensors (Hall sensors, magnetic contacts, etc.)


### Backend (separate repository)
- Node.js
- Express
- REST / MQTT communication
- Database (MongoDB / SQL)

---

## Installation

### Prerequisites
- Node.js (LTS recommended)
- Expo CLI
- Android Studio or Xcode (for emulators)
- Physical device (recommended for hardware testing)

### Install dependencies
```bash
npm install