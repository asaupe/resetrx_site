# Klaviyo Email Template: Lab Results Notification

## Event Name
`Quest Lab Results Received`

## Purpose
Notify users when their Quest lab results have been received and synced to their ResetRx account. The notification is privacy-focused, sending only aggregate counts and status flags - **no biomarker names or values**.

## Event Properties

### User Profile Data
- `email` - Patient email address
- `first_name` - Patient first name
- `last_name` - Patient last name

### Result Summary (Counts Only)
- `result_status` - Either "action_needed" or "all_normal"
- `has_abnormal_results` - Boolean flag
- `total_biomarkers_tested` - Count of biomarkers
- `abnormal_count` - Number of out-of-range results
- `normal_count` - Number of in-range results

### Order Details
- `order_key` - Quest order identifier
- `collection_date` - Formatted date (e.g., "January 15, 2026")
- `collection_date_iso` - ISO 8601 timestamp
- `result_date` - Formatted date results were received
- `result_date_iso` - ISO 8601 timestamp

### Metadata
- `user_id` - Suggestic user ID
- `notification_sent_at` - ISO 8601 timestamp

---

## Email Template Examples

### Template 1: Normal Results (All Clear)

**Subject:** ✅ Your Lab Results Are In

**Body:**
```
Hi {{ first_name|default:"there" }},

Good news! Your lab results from {{ event.collection_date }} are now available.

📊 **Results Summary:**
- {{ event.total_biomarkers_tested }} biomarkers tested
- All results are within normal range

**What's Next?**
Log in to your dashboard to view your complete results and continue your wellness journey.

[View Your Results](https://resetrx.com/dashboard)

Keep up the great work!

Best,
The ResetRx Team
```

---

### Template 2: Action Needed (Some Abnormal Results)

**Subject:** 📋 Your Lab Results Are Ready

**Body:**
```
Hi {{ first_name|default:"there" }},

Your lab results from {{ event.collection_date }} have been received and are now available in your dashboard.

📊 **Results Summary:**
- {{ event.total_biomarkers_tested }} biomarkers tested
- {{ event.abnormal_count }} result{{ event.abnormal_count|pluralize }} outside normal range
- {{ event.normal_count }} result{{ event.normal_count|pluralize }} within normal range

**What This Means:**
Some of your results fall outside the typical reference ranges. This doesn't necessarily indicate a problem, but it's important to review them with your healthcare team.

**Next Steps:**
1. Review your detailed results in your secure dashboard
2. Schedule a consultation with your health coach
3. Discuss any questions with your healthcare provider

[View Results & Schedule Consultation](https://resetrx.com/dashboard)

We're here to support your health journey,
The ResetRx Team
```

---

## Klaviyo Flow Setup

### Flow 1: Normal Results Flow

1. **Trigger:** Metric "Quest Lab Results Received" where `has_abnormal_results = false`

2. **Flow Steps:**
   - **Email:** Send "All Clear" template (immediate)
   - **Delay:** 3 days
   - **Conditional Split:** Check if user has viewed results
     - No → Send gentle reminder

---

### Flow 2: Abnormal Results Flow (Priority)

1. **Trigger:** Metric "Quest Lab Results Received" where `has_abnormal_results = true`

2. **Flow Steps:**
   - **Email:** Send "Action Needed" template (immediate)
   - **Delay:** 1 day
   - **Conditional Split:** Check if user has viewed results
     - No → Send follow-up reminder
   - **Delay:** 2 days
   - **Email:** Final reminder with support contact

---

## Conditional Logic in Templates

### Show different content based on result status:

```liquid
{% if event.has_abnormal_results %}
  <p style="color: #d97706;">{{ event.abnormal_count }} result{{ event.abnormal_count|pluralize }} require{{ event.abnormal_count|pluralize:"s," }} attention</p>
{% else %}
  <p style="color: #10b981;">All results are within normal range</p>
{% endif %}
```

### Dynamic call-to-action:

```liquid
{% if event.has_abnormal_results %}
  <a href="https://resetrx.com/dashboard" style="background: #dc2626;">Review Results & Schedule Consultation</a>
{% else %}
  <a href="https://resetrx.com/dashboard" style="background: #10b981;">View Your Results</a>
{% endif %}
```

### Create custom message based on counts:

```liquid
{% if event.abnormal_count == 0 %}
  All {{ event.total_biomarkers_tested }} of your results look great!
{% elsif event.abnormal_count == 1 %}
  One result needs your attention.
{% else %}
  {{ event.abnormal_count }} results need your attention.
{% endif %}
```

---

## Privacy & Compliance Notes

### ✅ What IS Included:
- Total number of tests
- Count of abnormal vs normal results  
- Test dates
- General status flags

### ❌ What is NOT Included:
- Biomarker names (e.g., "Cholesterol", "TSH")
- Actual values (e.g., 150 mg/dL)
- Reference ranges
- Specific diagnoses
- Detailed medical interpretation

### Why This Approach?
- **Privacy:** Minimizes PHI in marketing platform
- **Compliance:** Reduces HIPAA exposure
- **Security:** Limits sensitive data in email systems
- **User Experience:** Full details viewable in secure dashboard with proper context
- **Flexibility:** All messaging and logic handled in Klaviyo (no code deploys needed)

---

## Testing

### Test with Normal Results
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-lab-results-notification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "orderKey": "TEST123",
    "totalBiomarkers": 5,
    "abnormalCount": 0,
    "collectionDate": "2026-01-15T10:00:00Z",
    "resultDate": "2026-01-18T14:30:00Z",
    "hasAbnormalResults": false,
    "userId": "test-user-123"
  }'
```

### Test with Abnormal Results
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-lab-results-notification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "orderKey": "TEST456",
    "totalBiomarkers": 6,
    "abnormalCount": 2,
    "collectionDate": "2026-01-15T10:00:00Z",
    "resultDate": "2026-01-18T14:30:00Z",
    "hasAbnormalResults": true,
    "userId": "test-user-456"
  }'
```

### Verify in Klaviyo
1. Check Activity Feed for "Quest Lab Results Received" events
2. Verify correct flow triggered based on `has_abnormal_results`
3. Test email rendering with dynamic counts
4. Confirm links work correctly

---

## Integration

The event is automatically sent when:
1. Quest lab results are fetched from KHSS API
2. Results are synced to Suggestic biomarkers
3. User profile exists with valid email address

Sent from `sync-lab-results.js` after successful biomarker storage.

**Note:** If Klaviyo notification fails, lab sync still completes (non-critical operation).

---

## Metrics to Track

- Email open rate by result type (normal vs abnormal)
- Click-through rate to dashboard
- Time from notification to result view
- Consultation booking rate for abnormal results
- Follow-up engagement patterns
