/* Sample data, fictional. Results precomputed by tools/build-extract-samples.js */
window.GMAExtractSamples = [
 {
  "id": "invoice",
  "name": "Supplier invoice, Northfield Steel Supply (fictional)",
  "image": "samples/invoice.svg",
  "text": "Northfield Steel Supply\n88 Quarry Road, Millbrook, NH 03999\n(555) 010-2234\nINVOICE\nInvoice No: NSS-20418\nInvoice Date: 09/18/2026\nBill To: Pine Hollow Storage LLC\nJob: Pine Hollow mezzanine\nPO #: 5521\nTerms: Net 30\nQty Unit Description Unit Price Amount\n6 EA W12x26 x 24 ft beam 686.40 4,118.40\n8 EA W10x22 x 12 ft 6 in beam 302.50 2,420.00\n6 EA HSS6x6x1/4 x 14 ft column 292.95 1,757.70\n8 EA L4x4x3/8 x 20 ft angle 176.40 1,411.20\n1 LS Delivery, flatbed 185.00 185.00\nSubtotal $9,892.30\nSales Tax 6.25% $618.27\nTotal Due $10,510.57",
  "result": {
   "fields": {
    "doc_type": {
     "value": "Invoice",
     "confidence": "high",
     "note": ""
    },
    "vendor": {
     "value": "Northfield Steel Supply",
     "confidence": "medium",
     "note": "Top line of the doc. Check it."
    },
    "doc_number": {
     "value": "NSS-20418",
     "confidence": "high",
     "note": ""
    },
    "date": {
     "value": "2026-09-18",
     "confidence": "high",
     "note": ""
    },
    "po_number": {
     "value": "5521",
     "confidence": "high",
     "note": ""
    },
    "job": {
     "value": "Pine Hollow mezzanine",
     "confidence": "high",
     "note": ""
    },
    "customer": {
     "value": "Pine Hollow Storage LLC",
     "confidence": "high",
     "note": ""
    },
    "subtotal": {
     "value": "9892.30",
     "confidence": "high",
     "note": ""
    },
    "tax": {
     "value": "618.27",
     "confidence": "high",
     "note": ""
    },
    "total": {
     "value": "10510.57",
     "confidence": "high",
     "note": ""
    }
   },
   "line_items": [
    {
     "qty": 6,
     "unit": "EA",
     "description": "W12x26 x 24 ft beam",
     "unit_price": "686.40",
     "amount": "4118.40",
     "confidence": "high"
    },
    {
     "qty": 8,
     "unit": "EA",
     "description": "W10x22 x 12 ft 6 in beam",
     "unit_price": "302.50",
     "amount": "2420.00",
     "confidence": "high"
    },
    {
     "qty": 6,
     "unit": "EA",
     "description": "HSS6x6x1/4 x 14 ft column",
     "unit_price": "292.95",
     "amount": "1757.70",
     "confidence": "high"
    },
    {
     "qty": 8,
     "unit": "EA",
     "description": "L4x4x3/8 x 20 ft angle",
     "unit_price": "176.40",
     "amount": "1411.20",
     "confidence": "high"
    },
    {
     "qty": 1,
     "unit": "LS",
     "description": "Delivery, flatbed",
     "unit_price": "185.00",
     "amount": "185.00",
     "confidence": "high"
    }
   ],
   "checks": [
    "Line items add up to the subtotal.",
    "Subtotal plus tax matches the total."
   ]
  }
 },
 {
  "id": "estimate",
  "name": "Sub's estimate, Kettle Brook Coatings (fictional)",
  "image": "samples/estimate.svg",
  "text": "Kettle Brook Coatings\n14 Mill Pond Lane, Ashby Falls, MA 01999\n(555) 010-8871\nESTIMATE\nEstimate No: KBC-0912\nDate: October 2, 2026\nCustomer: Route 9 Car Wash\nProject: Entry canopy steel paint\nValid for 30 days\nQty Unit Description Rate Amount\n1 LS Surface prep, SSPC-SP2 hand tool 950.00 950.00\n3400 SF Primer, one coat, shop 0.85 2,890.00\n3400 SF Finish coat, polyurethane 1.10 3,740.00\n12 HR Touch-up after erection 78.00 936.00\nSubtotal $8,516.00\nTax $0.00\nEstimate Total $8,516.00",
  "result": {
   "fields": {
    "doc_type": {
     "value": "Estimate / quote",
     "confidence": "high",
     "note": ""
    },
    "vendor": {
     "value": "Kettle Brook Coatings",
     "confidence": "medium",
     "note": "Top line of the doc. Check it."
    },
    "doc_number": {
     "value": "KBC-0912",
     "confidence": "high",
     "note": ""
    },
    "date": {
     "value": "2026-10-02",
     "confidence": "high",
     "note": ""
    },
    "po_number": {
     "value": "",
     "confidence": "missing",
     "note": ""
    },
    "job": {
     "value": "Entry canopy steel paint",
     "confidence": "high",
     "note": ""
    },
    "customer": {
     "value": "Route 9 Car Wash",
     "confidence": "high",
     "note": ""
    },
    "subtotal": {
     "value": "8516.00",
     "confidence": "high",
     "note": ""
    },
    "tax": {
     "value": "0.00",
     "confidence": "high",
     "note": ""
    },
    "total": {
     "value": "8516.00",
     "confidence": "high",
     "note": ""
    }
   },
   "line_items": [
    {
     "qty": 1,
     "unit": "LS",
     "description": "Surface prep, SSPC-SP2 hand tool",
     "unit_price": "950.00",
     "amount": "950.00",
     "confidence": "high"
    },
    {
     "qty": 3400,
     "unit": "SF",
     "description": "Primer, one coat, shop",
     "unit_price": "0.85",
     "amount": "2890.00",
     "confidence": "high"
    },
    {
     "qty": 3400,
     "unit": "SF",
     "description": "Finish coat, polyurethane",
     "unit_price": "1.10",
     "amount": "3740.00",
     "confidence": "high"
    },
    {
     "qty": 12,
     "unit": "HR",
     "description": "Touch-up after erection",
     "unit_price": "78.00",
     "amount": "936.00",
     "confidence": "high"
    }
   ],
   "checks": [
    "Line items add up to the subtotal.",
    "Subtotal plus tax matches the total."
   ]
  }
 },
 {
  "id": "delivery",
  "name": "Delivery ticket, Blue Ledge Building Supply (fictional)",
  "image": "samples/delivery.svg",
  "text": "Blue Ledge Building Supply\n220 Depot Street, Harlow, VT 05999\nDELIVERY TICKET\nTicket No: BL-77810\nDelivery Date: 10/05/2026\nShip To: Birch Lane Duplex, lot 4\nJob: Birch Lane stair and rail\nPO #: 6104\nDriver: R. Tanner   Truck 12\nQty Unit Description\n2 EA MC12x10.6 x 16 ft stringer\n8 EA Pipe 1-1/2 STD x 21 ft\n28 EA L2x2x1/4 x 4 ft\n1 BOX 1/2 in A325 bolts, 50 ct",
  "result": {
   "fields": {
    "doc_type": {
     "value": "Delivery ticket",
     "confidence": "high",
     "note": ""
    },
    "vendor": {
     "value": "Blue Ledge Building Supply",
     "confidence": "medium",
     "note": "Top line of the doc. Check it."
    },
    "doc_number": {
     "value": "BL-77810",
     "confidence": "high",
     "note": ""
    },
    "date": {
     "value": "2026-10-05",
     "confidence": "high",
     "note": ""
    },
    "po_number": {
     "value": "6104",
     "confidence": "high",
     "note": ""
    },
    "job": {
     "value": "Birch Lane stair and rail",
     "confidence": "high",
     "note": ""
    },
    "customer": {
     "value": "Birch Lane Duplex, lot 4",
     "confidence": "high",
     "note": ""
    },
    "subtotal": {
     "value": "",
     "confidence": "missing",
     "note": ""
    },
    "tax": {
     "value": "",
     "confidence": "missing",
     "note": ""
    },
    "total": {
     "value": "",
     "confidence": "missing",
     "note": ""
    }
   },
   "line_items": [
    {
     "qty": 2,
     "unit": "EA",
     "description": "MC12x10.6 x 16 ft stringer",
     "unit_price": null,
     "amount": null,
     "confidence": "high"
    },
    {
     "qty": 8,
     "unit": "EA",
     "description": "Pipe 1-1/2 STD x 21 ft",
     "unit_price": null,
     "amount": null,
     "confidence": "high"
    },
    {
     "qty": 28,
     "unit": "EA",
     "description": "L2x2x1/4 x 4 ft",
     "unit_price": null,
     "amount": null,
     "confidence": "high"
    },
    {
     "qty": 1,
     "unit": "BOX",
     "description": "1/2 in A325 bolts, 50 ct",
     "unit_price": null,
     "amount": null,
     "confidence": "high"
    }
   ],
   "checks": []
  }
 }
];
