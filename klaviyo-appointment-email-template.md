# Klaviyo Email Template: Quest Appointment Confirmation

## Event Trigger
**Metric Name:** `Quest Appointment Booked`

## Email Template

---

### Subject Line
Your Quest Diagnostics Appointment is Confirmed - {{ event.appointment_date }}

### Preview Text
Confirmation #{{ event.confirmation_number }} | {{ event.location_name }}

---

## Email Body (HTML)

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .appointment-details { background: white; border-left: 4px solid #0066cc; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .confirmation-number { background: #fffbcc; border: 2px solid #ffeb3b; padding: 15px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; }
        .action-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
        .button { background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; display: inline-block; border-radius: 5px; margin: 10px 0; }
        .important-note { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>✅ Appointment Confirmed</h1>
            <p>Your Quest Diagnostics appointment has been successfully scheduled</p>
        </div>

        <!-- Confirmation Number -->
        <div class="confirmation-number">
            Confirmation #{{ event.confirmation_number }}
        </div>

        <!-- Appointment Details -->
        <div class="content">
            <h2>Appointment Details</h2>
            
            <div class="appointment-details">
                <div class="detail-row">
                    <span class="detail-label">📅 Date:</span>
                    <span class="detail-value">{{ event.appointment_date }}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">🕐 Time:</span>
                    <span class="detail-value">{{ event.appointment_time }}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">{{ event.location_name }}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">🏢 Address:</span>
                    <span class="detail-value">{{ event.location_address }}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">📞 Phone:</span>
                    <span class="detail-value">{{ event.location_phone }}</span>
                </div>
            </div>

            <!-- Reschedule/Cancel Instructions -->
            <div class="action-box">
                <h3>Need to Change Your Appointment?</h3>
                <p>{{ event.reschedule_instructions }}</p>
                <p><strong>Your Confirmation Number: {{ event.confirmation_number }}</strong></p>
                <a href="{{ event.reschedule_url }}" class="button">Manage Appointment</a>
            </div>

            <!-- Important Note -->
            <div class="important-note">
                <h4>⚠️ Important Note</h4>
                <p>{{ event.important_note }}</p>
                <p>For any changes to your appointment, please use the online portal above.</p>
            </div>

            <!-- What to Bring -->
            <div class="appointment-details">
                <h3>What to Bring</h3>
                <ul>
                    <li>Photo ID (driver's license, passport, etc.)</li>
                    <li>Insurance card (if applicable)</li>
                    <li>Your confirmation number: <strong>{{ event.confirmation_number }}</strong></li>
                </ul>
            </div>

            <!-- Preparation Instructions -->
            <div class="appointment-details">
                <h3>Before Your Visit</h3>
                <ul>
                    <li>Arrive 10-15 minutes early to complete check-in</li>
                    <li>Fasting may be required for some tests - check your test requirements</li>
                    <li>Bring a list of current medications if applicable</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>This email was sent by ResetRx</p>
            <p>Questions? Contact us at support@resetrx.life</p>
            <p>
                <a href="https://www.resetrx.life">Website</a> | 
                <a href="{{ event.reschedule_url }}">Manage Appointment</a>
            </p>
        </div>
    </div>
</body>
</html>
```

---

## Klaviyo Flow Setup

### 1. Create Flow
- **Trigger:** Metric `Quest Appointment Booked`
- **Filter:** None (send to all)

### 2. Email Action
- **Template:** Use the HTML template above
- **Send Time:** Immediately after trigger
- **From:** ResetRx <noreply@resetrx.life>
- **Subject:** Your Quest Diagnostics Appointment is Confirmed - {{ event.appointment_date }}

### 3. Event Properties Available

All these properties are available in the email template using `{{ event.property_name }}`:

**Appointment Details:**
- `confirmation_number` - Quest confirmation number
- `appointment_date` - Formatted date (e.g., "Monday, February 5, 2026")
- `appointment_time` - Formatted time (e.g., "10:40 AM")
- `appointment_datetime_iso` - ISO timestamp

**Location:**
- `location_name` - Lab location name
- `location_address` - Full address
- `location_phone` - Location phone
- `site_code` - Quest site code

**Reschedule Info:**
- `reschedule_url` - https://appointment.questdiagnostics.com/as-home
- `reschedule_instructions` - Instructions text
- `important_note` - Note about phones

**Order Info:**
- `order_key` - Quest order key
- `test_code` - Test code
- `lab_account` - Lab account number

**Patient:**
- `patient_id` - Patient ID
- `patient_dob` - Date of birth

**Metadata:**
- `booking_timestamp` - When booked
- `environment` - test/production
- `user_id` - Suggestic user ID

---

## SMS Template (Optional)

```
Quest Appointment Confirmed! 

📅 {{ event.appointment_date }}
🕐 {{ event.appointment_time }}
📍 {{ event.location_name }}

Confirmation #{{ event.confirmation_number }}

Need to change? Visit: {{ event.reschedule_url }}

- ResetRx
```

---

## Testing

To test this integration:

1. Book a test appointment through the system
2. Check Klaviyo Activity Feed for the "Quest Appointment Booked" event
3. Verify all event properties are populated correctly
4. Test the email flow to ensure it sends properly
5. Click through the reschedule link to confirm it works

---

## Integration Notes

- The event is sent **after** the appointment is confirmed with Quest
- The event is sent **after** saving to Suggestic custom attributes
- If Klaviyo fails, it won't prevent the booking from completing
- All errors are logged but non-blocking
- Email confirmation is sent immediately via Klaviyo flow
