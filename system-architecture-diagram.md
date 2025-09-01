# Database Repair & Consistent Query Answering System Architecture

## System Overview
```mermaid
graph TB
    %% User Interface Layer
    subgraph "Frontend (React - Port 3000)"
        UI[User Interface]
        subgraph "React Components"
            NAV[NavBar]
            FL[FileList]
            TV[TableView]
            RP[RepairPanel]
            RS[RepairSection]
            CCM[ColumnConfigModal]
            EEM[EditEntryModal]
        end
        
        subgraph "Utility Modules"
            DP[Data Parser]
            TD[Type Detection]
            VC[Violation Checker]
            RG[Repair Generator]
            EU[Edit Utils]
            EXP[Export Utils]
            SQL[SQL Utils]
        end
    end

    %% API Layer
    subgraph "Backend (Flask - Port 5000)"
        API[Flask API Server]
        CORS[CORS Middleware]
        
        subgraph "API Endpoints"
            EM["POST /export-mysql"]
            QT["POST /query-temp"]
            ROOT["GET /"]
        end
    end

    %% Data Storage Layer
    subgraph "Data Storage"
        MYSQL[(MySQL Database)]
        SQLITE[(In-Memory SQLite)]
        FILES[File System<br/>CSV/JSON/SQL]
    end

    %% External Systems
    USER[👤 User]

    %% Connections
    USER --> UI
    UI --> NAV
    UI --> FL
    UI --> TV
    UI --> RP
    UI --> RS
    UI --> CCM
    UI --> EEM

    NAV --> DP
    FL --> DP
    TV --> VC
    RP --> RG
    RS --> EXP
    CCM --> TD
    EEM --> EU

    DP --> SQL
    VC --> SQL
    RG --> SQL
    EXP --> SQL

    SQL --> API
    API --> CORS
    API --> EM
    API --> QT
    API --> ROOT

    EM --> MYSQL
    QT --> SQLITE
    API --> FILES

    style UI fill:#e1f5fe
    style API fill:#f3e5f5
    style MYSQL fill:#e8f5e8
    style SQLITE fill:#fff3e0
    style FILES fill:#fce4ec
```

## Detailed Component Architecture

### 1. Frontend Architecture (React)

```mermaid
graph LR
    subgraph "Main App Component"
        APP["App.js<br/>939 lines<br/>State Management"]
    end

    subgraph "UI Components"
        NAV["NavBar<br/>Navigation & Branding"]
        FL["FileList<br/>File Upload & Selection"]
        TV["TableView<br/>Data Display<br/>Violation Visualization"]
        RP["RepairPanel<br/>Repair Actions<br/>Check/Clear Operations"]
        RS["RepairSection<br/>Repair File Management<br/>Export Functions"]
        CCM["ColumnConfigModal<br/>Column Type Configuration"]
        EEM["EditEntryModal<br/>Row Editing Interface"]
    end

    subgraph "Utility Layer"
        DP["dataParser.js<br/>CSV/JSON Processing"]
        TD["typeDetection.js<br/>Column Type Inference"]
        VC["violationChecker.js<br/>Constraint Validation"]
        RG["repairGenerator.js<br/>Repair Strategy Generation"]
        EU["editUtils.js<br/>CRUD Operations"]
        EXP["exportUtils.js<br/>Data Export Functions"]
        SQL["sqlUtils.js<br/>Query Execution"]
    end

    APP --> NAV
    APP --> FL
    APP --> TV
    APP --> RP
    APP --> RS
    APP --> CCM
    APP --> EEM

    FL --> DP
    TV --> VC
    RP --> RG
    CCM --> TD
    EEM --> EU
    RS --> EXP
    
    DP --> SQL
    VC --> SQL
    RG --> SQL
    EXP --> SQL
```

### 2. Backend Architecture (Flask)

```mermaid
graph TB
    subgraph "Flask Application (app.py - 314 lines)"
        FLASK["Flask Server<br/>CORS Enabled<br/>Debug Mode"]
        
        subgraph "API Endpoints"
            EM["POST /export-mysql<br/>MySQL Export Generation"]
            QT["POST /query-temp<br/>In-Memory Query Execution"]
            ROOT["GET /<br/>Health Check"]
        end
        
        subgraph "Database Connections"
            MYSQL_CONN["MySQL Connector<br/>Production DB"]
            SQLITE_CONN["SQLite In-Memory<br/>Temporary Queries"]
        end
        
        subgraph "Data Processing"
            TABLE_CREATOR[Dynamic Table Creation]
            CONSTRAINT_HANDLER[Constraint Processing]
            QUERY_EXECUTOR[SQL Query Execution]
            FK_PROCESSOR[Foreign Key Handler]
        end
    end

    FLASK --> EM
    FLASK --> QT
    FLASK --> ROOT

    EM --> MYSQL_CONN
    QT --> SQLITE_CONN

    EM --> TABLE_CREATOR
    QT --> TABLE_CREATOR
    TABLE_CREATOR --> CONSTRAINT_HANDLER
    CONSTRAINT_HANDLER --> FK_PROCESSOR
    FK_PROCESSOR --> QUERY_EXECUTOR

    style FLASK fill:#f3e5f5
    style EM fill:#e8f5e8
    style QT fill:#fff3e0
    style MYSQL_CONN fill:#e1f5fe
    style SQLITE_CONN fill:#fce4ec
```

### 3. Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (React)
    participant BE as Backend (Flask)
    participant DB as Database
    participant FS as File System

    Note over U,FS: Data Import & Processing Flow
    U->>FE: Upload CSV/JSON File
    FE->>FE: Parse File (dataParser.js)
    FE->>FE: Detect Column Types (typeDetection.js)
    FE->>FE: Configure Columns (ColumnConfigModal)
    
    Note over U,FS: Violation Detection & Repair
    FE->>FE: Check Violations (violationChecker.js)
    FE->>FE: Generate Repairs (repairGenerator.js)
    FE->>FE: Display Violations (TableView)
    
    Note over U,FS: Query Execution Flow
    U->>FE: Enter SQL Query
    FE->>BE: POST /query-temp
    BE->>DB: Create In-Memory Tables (SQLite)
    BE->>DB: Execute Query
    DB->>BE: Return Results
    BE->>FE: JSON Response
    FE->>U: Display Results
    
    Note over U,FS: Export Flow
    U->>FE: Request Export
    FE->>BE: POST /export-mysql
    BE->>FS: Generate SQL File
    BE->>U: Download SQL File
```

### 4. State Management Architecture

```mermaid
graph TB
    subgraph "App.js State Management"
        subgraph "File Management State"
            FILES[files[]]
            SELECTED_FILE[selectedFile]
            FILE_TABLES[fileTables{}]
            TABLE_DATA[tableData[]]
        end
        
        subgraph "Repair State"
            REPAIR_FILES[repairFiles[]]
            SELECTED_REPAIR[selectedRepairFile]
            REPAIR_TRIGGERED[repairTriggered]
            REPAIR_CHECK_MODE[repairCheckMode]
        end
        
        subgraph "Constraint State"
            CONFIRMED_CONSTRAINTS[confirmedConstraints[]]
            CONFIRMED_TYPES[confirmedTypes[]]
            FK_CONFIG[foreignKeyConfig{}]
        end
        
        subgraph "UI State"
            EDIT_MODAL[editModal{}]
            CHECK_RESULTS[checkResults]
            COLUMN_CONFIG[columnConfig{}]
        end
        
        subgraph "Query State"
            SQL_QUERY[sqlQuery]
            SQL_RESULT[sqlResult]
            SQL_ERROR[sqlError]
            SQL_MODAL[sqlModalOpen]
        end
    end

    FILES --> SELECTED_FILE
    SELECTED_FILE --> FILE_TABLES
    FILE_TABLES --> TABLE_DATA
    
    TABLE_DATA --> REPAIR_FILES
    REPAIR_FILES --> SELECTED_REPAIR
    REPAIR_TRIGGERED --> REPAIR_CHECK_MODE
    
    CONFIRMED_CONSTRAINTS --> FK_CONFIG
    CONFIRMED_TYPES --> FK_CONFIG
    
    style FILES fill:#e1f5fe
    style REPAIR_FILES fill:#e8f5e8
    style CONFIRMED_CONSTRAINTS fill:#fff3e0
    style EDIT_MODAL fill:#f3e5f5
    style SQL_QUERY fill:#fce4ec
```

### 5. Technology Stack

```mermaid
graph TB
    subgraph "Frontend Stack"
        REACT["React 18+<br/>Functional Components<br/>Hooks (useState, useRef)"]
        RTL["React Testing Library<br/>Jest Testing Framework<br/>133 Test Cases"]
        CSS["CSS Modules<br/>Component Styling"]
        HTTP["Fetch API<br/>HTTP Requests"]
    end

    subgraph "Backend Stack"
        FLASK["Flask 2.x<br/>Python Web Framework"]
        FLASK_CORS["Flask-CORS<br/>Cross-Origin Support"]
        MYSQL_CONN["mysql-connector-python<br/>MySQL Database Driver"]
        SQLITE3["sqlite3<br/>In-Memory Database"]
    end

    subgraph "Database Stack"
        MYSQL["MySQL 8+<br/>Production Database"]
        SQLITE_MEM["SQLite In-Memory<br/>Temporary Query Processing"]
    end

    subgraph "Development Tools"
        NPM[npm<br/>Package Manager]
        PIP[pip<br/>Python Package Manager]
        VENV[Python Virtual Environment]
        JEST[Jest Test Runner]
    end

    REACT --> HTTP
    HTTP --> FLASK
    FLASK --> FLASK_CORS
    FLASK --> MYSQL_CONN
    FLASK --> SQLITE3
    MYSQL_CONN --> MYSQL
    SQLITE3 --> SQLITE_MEM

    style REACT fill:#61dafb
    style FLASK fill:#000000,color:#ffffff
    style MYSQL fill:#4479a1,color:#ffffff
    style SQLITE_MEM fill:#003b57,color:#ffffff
```

### 6. Security & Configuration

```mermaid
graph LR
    subgraph "Security Measures"
        CORS_CONFIG["CORS Configuration<br/>Allowed Origins:<br/>localhost:3000<br/>127.0.0.1:3000"]
        ENV_VARS["Environment Variables<br/>MYSQL_HOST<br/>MYSQL_USER<br/>MYSQL_PASSWORD<br/>MYSQL_DATABASE"]
        INPUT_VALIDATION["Input Validation<br/>SQL Injection Prevention<br/>File Type Validation"]
    end

    subgraph "Configuration Management"
        DB_CONFIG["Database Configuration<br/>Connection Pooling<br/>Error Handling"]
        FILE_HANDLING["File Handling<br/>CSV/JSON Parsing<br/>Memory Management"]
        ERROR_HANDLING["Error Handling<br/>Try-Catch Blocks<br/>User-Friendly Messages"]
    end

    CORS_CONFIG --> DB_CONFIG
    ENV_VARS --> DB_CONFIG
    INPUT_VALIDATION --> FILE_HANDLING
    DB_CONFIG --> ERROR_HANDLING
    FILE_HANDLING --> ERROR_HANDLING

    style CORS_CONFIG fill:#ffeb3b
    style ENV_VARS fill:#4caf50
    style INPUT_VALIDATION fill:#f44336,color:#ffffff
    style DB_CONFIG fill:#2196f3,color:#ffffff
    style FILE_HANDLING fill:#ff9800,color:#ffffff
    style ERROR_HANDLING fill:#9c27b0,color:#ffffff
```

## Key Features & Capabilities

### Core Functionalities
1. **Data Import & Processing**
   - CSV/JSON file upload and parsing
   - Automatic column type detection
   - Manual column configuration

2. **Constraint Management**
   - Primary key constraints
   - Unique constraints
   - Foreign key relationships
   - NOT NULL constraints

3. **Violation Detection**
   - Real-time constraint violation checking
   - Visual violation indicators
   - Detailed violation reporting

4. **Data Repair**
   - Multiple repair strategies
   - Primary key repair generation
   - General repair algorithms
   - Partial repair options
   - Custom repair capabilities

5. **Query Processing**
   - In-memory SQLite query execution
   - Foreign key relationship handling
   - Complex JOIN operations
   - Real-time query results

6. **Data Export**
   - MySQL-compatible SQL export
   - CSV export functionality
   - JSON export options
   - Downloadable file generation

### System Characteristics
- **Scalability**: In-memory processing for fast operations
- **Reliability**: Comprehensive test coverage (133 tests, 100% pass rate)
- **Maintainability**: Modular architecture with clear separation of concerns
- **Usability**: Intuitive React-based user interface
- **Performance**: Optimized data structures and efficient algorithms

This architecture provides a robust foundation for database repair and consistent query answering, with clear separation between frontend presentation, backend processing, and data storage layers.
