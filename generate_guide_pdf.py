"""
Generates FoodWings_Backend_Architecture_and_Code_Guide.pdf
A comprehensive and beautifully designed guide explaining the FoodWings backend architecture,
file by file, endpoint by endpoint, and how to understand it deeply.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 755, "FoodWings (Swiggy Clone) - Backend Architecture & Code Guide")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.75)
            self.line(54, 747, 558, 747)
        
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, footer_text)
        self.drawString(54, 36, "Confidential & Proprietary - FoodWings Technical Documentation")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 48, 558, 48)
        
        self.restoreState()

def build_pdf(filename="FoodWings_Backend_Architecture_and_Code_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#FC8019")    # Swiggy Orange
    navy_dark = colors.HexColor("#1A202C")        # Deep Dark Slate
    slate_sub = colors.HexColor("#4A5568")        # Subtitle Slate
    bg_code = colors.HexColor("#F8FAFC")          # Code background
    border_color = colors.HexColor("#E2E8F0")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=navy_dark,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=primary_color,
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=navy_dark,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#2B6CB0"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#2D3748"),
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'Code_Block',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#805AD5"),
        spaceAfter=0
    )

    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=10,
        textColor=colors.white,
    )

    story = []

    # Title Banner Box
    title_data = [
        [
            Paragraph("🍗 FOODWINGS BACKEND GUIDE", title_style),
        ],
        [
            Paragraph("Complete Architecture, File-by-File Breakdown & Step-by-Step Learning Guide", subtitle_style),
        ],
        [
            Paragraph("<b>Stack:</b> FastAPI (Python) • PostgreSQL 16 (psycopg3 Pool) • Plain JavaScript Frontend • JWT Auth", body_style)
        ]
    ]
    
    t_header = Table(title_data, colWidths=[504])
    t_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFF5EB")),
        ('BOX', (0,0), (-1,-1), 1.5, primary_color),
        ('PADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 12),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 14))

    # SECTION 1: ARCHITECTURAL OVERVIEW
    story.append(Paragraph("1. System Architecture & Mental Model", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))
    
    story.append(Paragraph(
        "FoodWings operates as a unified multi-role food delivery platform. Instead of creating 4 separate microservices for customers, restaurants, delivery partners, and admins, FoodWings employs a <b>Clean Modular Monolith</b> design. All 4 interfaces interact with a single high-performance FastAPI backend connected to a shared PostgreSQL database.",
        body_style
    ))
    
    arch_summary_data = [
        [Paragraph("<b>Role / Component</b>", body_style), Paragraph("<b>Key Responsibilities & Flow</b>", body_style), Paragraph("<b>Key Tables</b>", body_style)],
        [Paragraph("<b>1. Customer</b>", body_style), Paragraph("Browse restaurants, view menus, manage cart, place orders, make card/COD payments, track delivery in real-time.", body_style), Paragraph("<code>users</code>, <code>restaurants</code>, <code>menu_items</code>, <code>orders</code>, <code>cart_items</code>", code_style)],
        [Paragraph("<b>2. Restaurant</b>", body_style), Paragraph("Onboard new restaurant, toggle store Open/Closed, manage live incoming orders (Accept / Reject / Food Ready).", body_style), Paragraph("<code>restaurants</code>, <code>orders</code>, <code>order_status_history</code>", code_style)],
        [Paragraph("<b>3. Rider (Partner)</b>", body_style), Paragraph("Register & upload verification docs, toggle Online/Offline, receive nearby order assignments, accept/pickup/deliver.", body_style), Paragraph("<code>delivery_partners</code>, <code>partner_documents</code>, <code>delivery_assignments</code>", code_style)],
        [Paragraph("<b>4. Admin</b>", body_style), Paragraph("Approve or reject restaurant partner registrations and rider document verifications.", body_style), Paragraph("<code>restaurants</code>, <code>partner_documents</code>, <code>user_roles</code>", code_style)],
        [Paragraph("<b>5. Mock Gateway</b>", body_style), Paragraph("Simulates Stripe/Razorpay credit card tokenization, authorization, capture, and webhooks safely.", body_style), Paragraph("<code>payment_transactions</code>, <code>payment_methods</code>", code_style)],
    ]
    
    t_arch = Table(arch_summary_data, colWidths=[110, 240, 154])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 14))

    # SECTION 2: DIRECTORY STRUCTURE & FILE BREAKDOWN
    story.append(Paragraph("2. Backend Directory Structure Explained", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))
    
    files_info = [
        ("config.py", "App Configuration", "Uses Pydantic BaseSettings to read environment variables (PostgreSQL connection URI, JWT secrets, OTP expiry, Rate limits, Mock gateway flags). Everything is strictly typed and centralized."),
        ("db.py", "Connection Pool & Transactions", "Manages high-concurrency PostgreSQL connection pooling with <code>psycopg_pool.ConnectionPool</code>. Features the critical <code>transaction(conn)</code> context manager that ensures ACID multi-table atomic rollbacks upon any error."),
        ("logging_setup.py", "PCI-DSS Redaction Filter", "Security enforcement layer: intercepts Python log records and replaces any 16-digit credit card number or 3-digit CVV with asterisks (<code>****</code>) before it is written to disk or console. Prevents compliance violations."),
        ("security.py", "JWT Tokens & Role Auth", "Handles token generation (<code>create_token</code>), user context extraction (<code>current_user</code>), cryptographic SHA-256 OTP hashing (<code>hash_otp</code>), and FastAPI role-checking dependency injection (<code>require_roles</code>)."),
        ("schemas.py", "Pydantic Input Validation", "Strict request validation schemas using Pydantic v2. Validates phone formats (<code>^+?[0-9]{10,14}$</code>), 6-digit OTPs, addresses, cart items, onboard forms, and payment requests before they ever hit the database."),
        ("errors.py", "Global Exception Handlers", "Catches all Unhandled Exceptions, validation errors, and HTTPExceptions, formatting them into standard JSON responses with proper HTTP status codes, error messages, and meta tracking IDs."),
        ("mock_gateway.py", "Payment Gateway Simulator", "Provides full Razorpay/Stripe mock APIs for testing. Converts card inputs into secure one-time tokens, simulates success/decline card numbers, signs webhooks via HMAC-SHA256, and handles refunds."),
        ("services/gateway.py", "Gateway Client Abstraction", "Decouples the core application from specific payment processors. Offers a standard interface (<code>create_order</code>, <code>charge</code>, <code>refund</code>). Sanitizes gateway payloads (Layer 8 security rule) to discard unvetted card keys."),
        ("services/order_flow.py", "Order State Machine & Dispatch", "Encapsulates order transitions (<code>change_status</code>) with history logging and automatic geospatial delivery partner dispatch (<code>offer_to_nearest_partner</code>) based on distance and availability."),
        ("main.py", "Single-File Unified API", "The master controller! Houses all route definitions, database transactions, request routing, static file mounting, and lifespan management. Grouped logically into 11 sections for maximum readability.")
    ]

    file_table_data = [[Paragraph("<b>File Path</b>", body_style), Paragraph("<b>Category</b>", body_style), Paragraph("<b>Detailed Purpose & What It Does</b>", body_style)]]
    for fname, cat, desc in files_info:
        file_table_data.append([
            Paragraph(f"<code>{fname}</code>", code_style),
            Paragraph(f"<b>{cat}</b>", body_style),
            Paragraph(desc, body_style)
        ])
        
    t_files = Table(file_table_data, colWidths=[100, 110, 294])
    t_files.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_files)
    
    story.append(PageBreak())

    # SECTION 3: DEEP DIVE INTO CRITICAL COMPONENTS
    story.append(Paragraph("3. Deep Dive: Key Architectural Patterns", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))

    story.append(Paragraph("A. Passwordless Authentication & Role Multi-Tenancy", h2_style))
    story.append(Paragraph(
        "FoodWings does not use passwords. Users authenticate via an OTP sent to their phone number. A single human can have multiple roles (e.g. they can be a Customer AND a Delivery Partner).",
        body_style
    ))
    story.append(Paragraph("• <b>OTP Security:</b> Raw OTPs are NEVER saved in the database. <code>security.hash_otp(phone, otp)</code> computes a SHA-256 digest with salt. Only the hash is saved in <code>otp_requests</code>.", bullet_style))
    story.append(Paragraph("• <b>Single-Use Consumption:</b> <code>consume_otp(conn, phone, otp, purpose)</code> verifies the hash, checks expiry (5 mins), limits attempts (max 3), and marks <code>used_at = now()</code> in a single transaction.", bullet_style))
    story.append(Paragraph("• <b>Unified User Table:</b> The <code>users</code> table stores the user profile, while <code>user_roles</code> connects a user ID to multiple roles (1=Customer, 2=Owner, 3=Staff, 4=Rider, 5=Admin).", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("B. Database Connection Pooling & Safe Transactions", h2_style))
    story.append(Paragraph(
        "Under <code>api/app/db.py</code>, we manage a connection pool configured for high concurrency:",
        body_style
    ))
    story.append(Paragraph("• <b>Autocommit Mode:</b> Reads run fast without leaving open transaction locks.", bullet_style))
    story.append(Paragraph("• <b>Atomic Writes:</b> Every multi-table mutation uses <code>with transaction(conn):</code>. If any step fails (e.g. stock deduction fails after order creation), PostgreSQL automatically rolls back the entire operation.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("C. PCI-DSS Compliance & Card Data Isolation", h2_style))
    story.append(Paragraph(
        "A critical real-world architectural design implemented in FoodWings:",
        body_style
    ))
    story.append(Paragraph("• <b>Zero Card Storage:</b> Card numbers and CVVs never touch the application database.", bullet_style))
    story.append(Paragraph("• <b>Client-side Tokenization:</b> The frontend sends card data directly to the Mock Gateway, which issues a safe token (<code>tok_xxxx</code>). Only this token is sent to the backend.", bullet_style))
    story.append(Paragraph("• <b>Logging Redaction:</b> <code>logging_setup.py</code> intercepts all log records using regex filters to mask card and CVV digits.", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 4: THE 11 SECTIONS OF MAIN.PY
    story.append(Paragraph("4. Breakdown of main.py (The 11 Sections)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))

    sections_main = [
        ("Section 1", "Setup, Logging & Lifespan", "Initializes FastAPI, configures CORS middleware, registers startup/shutdown hooks to open/close the database pool and load mock gateway tokens."),
        ("Section 2", "Security & Role Checking", "Contains helper functions to extract JWT from Authorization header and enforce role checks (e.g. requiring role 2 for restaurant actions)."),
        ("Section 3", "Authentication (/auth/*)", "POST /auth/otp/request, POST /auth/check-phone, POST /auth/register, POST /auth/login, POST /auth/refresh, and GET /me. Handles registration and login across all 3 apps."),
        ("Section 4", "Customer & Menu (/restaurants, /cart)", "GET /restaurants (filter open stores), GET /restaurants/{id}/menu (nested category items), POST /me/addresses, and full Cart management (GET/POST/DELETE)."),
        ("Section 5", "Order & Checkout (/orders/*)", "POST /orders/quote (calculates taxes, packaging, delivery fee, coupons), POST /orders/checkout (creates order in PENDING state), GET /me/orders (history & tracking)."),
        ("Section 6", "Payments (/payments/*)", "POST /payments/create-intent (creates gateway order), POST /payments/confirm (charges card token, transitions order to PAID/PLACED), POST /payments/webhook."),
        ("Section 7", "Restaurant Owner (/restaurant/*)", "POST /restaurants/onboard (onboards new restaurant), GET /restaurant/me, POST /restaurant/open-toggle, GET /restaurant/orders, and POST /restaurant/orders/{id}/status."),
        ("Section 8", "Delivery Partner (/partner/*)", "POST /partners/onboard, POST /partner/online, POST /partner/location (GPS updates), GET /partner/available-orders, POST /partner/orders/{id}/accept/pickup/deliver."),
        ("Section 9", "Admin Operations (/admin/*)", "POST /admin/restaurants/{id}/approve, POST /admin/partners/{id}/verify-docs. Allows admin to review and activate pending restaurants and drivers."),
        ("Section 10", "Mock Gateway (/mock-gateway/*)", "Routes mock payment transactions for development and automated testing without requiring live third-party accounts."),
        ("Section 11", "Health & Static Serving", "GET /health (verifies DB connection) and mounts the frontend HTML/JS files to serve the complete application on a single port.")
    ]

    sec_table_data = [[Paragraph("<b>Section</b>", body_style), Paragraph("<b>Title & Routes</b>", body_style), Paragraph("<b>Core Logic & Explanation</b>", body_style)]]
    for s_no, s_title, s_desc in sections_main:
        sec_table_data.append([
            Paragraph(f"<b>{s_no}</b>", body_style),
            Paragraph(f"<b>{s_title}</b>", body_style),
            Paragraph(s_desc, body_style)
        ])
        
    t_sec = Table(sec_table_data, colWidths=[65, 145, 294])
    t_sec.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_sec)

    story.append(PageBreak())

    # SECTION 5: HOW AN ORDER MOVES (STEP-BY-STEP FLOW)
    story.append(Paragraph("5. Step-by-Step Lifecycle of an Order", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))
    
    order_lifecycle = [
        ("Step 1: Browsing & Cart", "Customer selects restaurant, chooses dishes, and adds items to cart. The backend verifies item availability and pricing."),
        ("Step 2: Quote & Checkout", "<code>POST /orders/quote</code> computes item total + GST (5%) + packaging + delivery fee - discounts. <code>POST /orders/checkout</code> locks prices and creates order with status <code>PLACED</code>."),
        ("Step 3: Payment Confirmation", "Customer pays via MockCard / UPI. <code>POST /payments/confirm</code> charges token and records transaction. Order moves to <code>PAYMENT_SUCCESS</code>."),
        ("Step 4: Restaurant Acceptance", "Restaurant owner sees live order in dashboard, clicks Accept -> status becomes <code>ACCEPTED</code>. Kitchen prepares food -> status becomes <code>PREPARING</code>."),
        ("Step 5: Rider Auto-Assignment", "When food is ready (<code>READY_FOR_PICKUP</code>), <code>order_flow.py</code> finds nearest online partner with no active order and creates assignment."),
        ("Step 6: Pickup & Delivery", "Rider accepts order, arrives at restaurant, collects food (<code>PICKED_UP</code>), navigates to customer address, and marks <code>DELIVERED</code>.")
    ]

    for title, desc in order_lifecycle:
        story.append(Paragraph(f"<b>{title}</b>", h2_style))
        story.append(Paragraph(desc, body_style))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 10))

    # SECTION 6: HOW TO STUDY & EXPLAIN THIS PROJECT
    story.append(Paragraph("6. How to Study, Understand, and Present This Project", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=8))
    
    story.append(Paragraph(
        "Use this 4-step framework when reviewing code or explaining this system in interviews or presentations:",
        body_style
    ))
    
    tips = [
        ("1. Trace Requests from Route to DB", "Start in <code>main.py</code> at any endpoint (e.g. <code>/auth/register</code>). Follow the Pydantic schema in <code>schemas.py</code>, see how the database connection is acquired via <code>get_conn()</code>, observe the <code>with transaction(conn):</code> block, and see the final returned JSON dictionary."),
        ("2. Understand Data Ownership & Roles", "Notice how JWT claims (<code>user_id</code> and <code>roles</code>) protect each section. A customer cannot call restaurant endpoints because <code>require_roles(2, 3)</code> checks their role ID."),
        ("3. Run Automated Tests with Pytest", "Run <code>pytest -q</code> to see 12 comprehensive integration tests validating auth, registration, concurrency, role isolation, and payments. Read <code>tests/test_auth_register_login.py</code> as living documentation!"),
        ("4. Key Concepts to Mention in Interviews", "Highlight: <b>Connection Pooling</b> (efficient DB scaling), <b>ACID Transactions</b> (no orphan data), <b>PCI-DSS Compliance</b> (tokenized payments without card liability), <b>Passwordless OTP Auth</b>, and <b>Clean Modular Monolith architecture</b>.")
    ]

    for title, desc in tips:
        story.append(Paragraph(f"<b>{title}</b>", h2_style))
        story.append(Paragraph(desc, body_style))
        story.append(Spacer(1, 2))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully created: {filename}")

if __name__ == "__main__":
    build_pdf()
