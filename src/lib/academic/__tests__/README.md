# Semetra Academic Engine E2E Test Suite

Comprehensive end-to-end tests for the Semetra academic calculation and validation system.

## Overview

This test suite validates the complete academic workflow across multiple international grade systems and policies. The tests are organized into two main modules:

### 1. Engine Tests (`engine.test.ts`)

Tests for pure calculation functions with no side effects. Covers:

- **Rounding Engine**: `applyRounding()` with normal, floor, ceil, and bankers rounding
- **Grade Validation**: `isPassingGrade()`, `compareGrades()` across different scales
- **Normalization**: Converting local grades to 0-100 internal score
- **Grade Conversion**: Converting between grade scales (CH ↔ DE ↔ UK ↔ IT)
- **Bayerische Formel**: German conversion formula for international grades
- **Module Grading**: Weighted component calculation with mandatory requirements
- **Pass Policies**: Evaluating pass/fail based on policy type
- **Attempt Resolution**: Best/latest attempt selection and retake eligibility
- **GPA Calculation**: Weighted and filtered GPA computation
- **Degree Classification**: UK honours classification (1st, 2:1, 2:2, 3rd, Fail)
- **Prerequisites**: Checking required, recommended, and corequisite prerequisites
- **Completion Policies**: Evaluating program completion eligibility

### 2. Validation Tests (`validation.test.ts`)

Tests for validation services that check business rules and constraints. Covers:

- **ModuleValidator**: Publishing validation, component weights, prerequisite cycles
- **ProgramValidator**: Structure validation, requirement groups, completion policies
- **EnrollmentValidator**: Enrollment eligibility, prerequisites, duplicate checks

## Test Data: International Grade Scales

Tests use realistic data from four countries:

### Swiss System (1-6 scale)
```
- Scale: 1.0 to 6.0
- Higher is Better
- Pass value: 4.0
- Example: 4.2 = "Good" / "Bien"
- Normalized: 66% (4.2-1)/(6-1)*100
```

### German System (1-5 scale)
```
- Scale: 1.0 to 5.0
- Lower is Better (reverse quality)
- Pass value: 4.0
- Example: 2.3 = "Good" / "Gut"
- Normalized: 67.5% (5-2.3)/(5-1)*100
- Special: Bayerische Formel for conversion
```

### UK System (0-100 percentage)
```
- Scale: 0 to 100
- Higher is Better
- Pass value: 40
- Honours: 1st (70+), 2:1 (60+), 2:2 (50+), 3rd (40+)
- Example: 72 = "Upper Second Class"
```

### Italian System (18-30 scale with Lode)
```
- Scale: 0 to 30
- Higher is Better
- Pass value: 18
- Honours: 30 e lode (30 with distinction)
- Example: 27 = "Excellent"
```

## Running Tests

### Installation

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test engine.test.ts
npm test validation.test.ts
```

### Run with UI Dashboard

```bash
npm run test:ui
```

### Generate Coverage Report

```bash
npm run test:coverage
```

## Test Organization

### Engine Tests Structure

1. **Rounding Engine** (7 tests)
   - Normal, floor, ceil, bankers rounding
   - Edge cases (roundTo = 0)

2. **Grade Validation** (4 test suites, 18 tests)
   - `isPassingGrade`: Swiss, German, UK, Italian
   - `compareGrades`: Scale-specific comparisons
   - Edge cases and boundary values

3. **Normalization Engine** (4 tests)
   - Linear mapping for higher-is-better scales
   - Inverse mapping for German (lower-is-better)
   - Clamping to [0, 100]

4. **Grade Conversion** (4 tests)
   - Cross-scale conversions with confidence
   - Same-scale conversions with high confidence
   - Different scale type conversions with lower confidence

5. **Bayerische Formel** (4 tests)
   - UK → German conversion
   - Italian → German conversion
   - Direct German scale handling
   - Clamping to [1.0, 5.0]

6. **Module Grade Calculation** (4 tests)
   - Weighted average of components
   - Mandatory component failure blocking pass
   - Missing component handling
   - Rounding policy application

7. **Pass Policy Evaluation** (4 tests)
   - Overall threshold policy
   - Mandatory components policy
   - Null grade handling
   - Scale-specific pass determination

8. **Attempt Resolution** (5 tests)
   - Best attempt selection
   - Latest attempt selection
   - No valid attempts handling
   - Max attempts blocking retake
   - Retake eligibility with policy

9. **GPA Calculation** (5 tests)
   - Weighted by credits
   - Excluding failed modules
   - Excluding repeats
   - Empty input
   - Zero credits handling

10. **Degree Classification** (6 tests)
    - All honours classes
    - Boundary conditions
    - UK classification scheme

11. **Prerequisite Checking** (5 tests)
    - Required prerequisites
    - Recommended prerequisites
    - Corequisite handling
    - Current term enrollment

12. **Completion Policy** (8 tests)
    - All requirements met
    - Individual requirement failures
    - Multiple requirement failures
    - Null GPA handling
    - Policies without certain requirements

13. **Integration Scenarios** (4 realistic workflows)
    - Swiss student complete workflow
    - German student workflow
    - UK student classification
    - Multi-component assessment

### Validation Tests Structure

1. **ModuleValidator** (8 tests)
   - Valid module validation
   - Missing code, scale, policy, credit scheme
   - Invalid ECTS (zero, negative)
   - Component weight validation
   - Prerequisite cycle detection
   - Missing prerequisite modules
   - Zero-weight component warnings

2. **ProgramValidator** (11 tests)
   - Valid program structure
   - Invalid group credits
   - Invalid group modules
   - Thesis/internship requirements
   - Group coverage analysis
   - Orphan module detection
   - Completion policy validation
   - Duration constraints
   - GPA thresholds

3. **EnrollmentValidator** (6 tests)
   - Valid enrollment
   - Module not found
   - Module not active
   - Required prerequisites missing
   - Recommended prerequisites missing
   - Duplicate enrollment in term
   - Retake policy integration

4. **Integration Scenarios** (4 realistic workflows)
   - Swiss module publishing
   - German module publishing
   - Complex program with thesis/internship
   - Complex prerequisite chains

## Test Data Patterns

### Module Examples

```typescript
// Swiss computing module
const swissModule: AcademicModule = {
  id: "module-1",
  name: "Informatik I",
  moduleCode: "INF-101",
  ects: 6,
  gradeScaleId: "scale-ch-1-6",
  language: "German",
  isCompulsory: true,
  deliveryMode: "onsite",
  prerequisitesJson: ["module-basics"]
};

// German mathematics module
const germanModule: AcademicModule = {
  id: "module-2",
  name: "Mathematik für Informatik",
  moduleCode: "MAT-201",
  ects: 8,
  gradeScaleId: "scale-de-1-5",
  language: "German"
};
```

### Assessment Component Examples

```typescript
const assessmentComponents: AssessmentComponent[] = [
  {
    id: "comp-exam",
    name: "Written Exam",
    componentType: "written_exam",
    weightPercent: 70,
    mandatoryToPass: true,
    contributesToFinal: true
  },
  {
    id: "comp-project",
    name: "Project Work",
    componentType: "project",
    weightPercent: 30,
    mandatoryToPass: false,
    contributesToFinal: true
  }
];
```

### Grade Examples

```typescript
// Swiss student passes with 4.5 (1-6 scale)
const swissGrade = 4.5;
const isPass = isPassingGrade(swissGrade, chGradeScale); // true

// German student gets 2.3 (1-5 scale, lower is better)
const germanGrade = 2.3;
const isPass = isPassingGrade(germanGrade, deGradeScale); // true

// UK student scores 75%
const ukGrade = 75;
const classification = classifyDegree(ukGrade, ukClassificationScheme); // "First Class Honours"
```

## Key Algorithms Tested

### 1. Grade Normalization

Converts any local grade to 0-100 internal score for international comparison:

**For higher-is-better scales (CH, UK, IT):**
```
normalized = ((grade - min) / (max - min)) * 100
```

**For lower-is-better scales (DE, AT, CZ):**
```
normalized = ((max - grade) / (max - min)) * 100
```

### 2. Grade Conversion

Two-step process with confidence tracking:

```
1. Normalize source to 0-100
2. Map 0-100 to target scale
3. Apply target step size rounding
4. Calculate confidence (lower if different types)
```

### 3. Bayerische Formel

Official German reference conversion for international grades:

```
German = 1 + 3 × (Nmax − Nd) / (Nmax − Nmin_pass)

Where:
  Nmax = best achievable grade in source
  Nd   = achieved grade
  Nmin_pass = lowest passing grade in source
```

### 4. Module Grade with Components

Weighted average with mandatory requirements:

```
finalGrade = Σ(componentGrade × weight) / Σ(weights)
passed = (finalGrade ≥ passValue) AND (allMandatoryPassed)
```

### 5. GPA Calculation

Weighted by credits with filtering:

```
GPA = Σ(grade × credits) / Σ(credits)

Filters applied:
  - Exclude failed modules (if configured)
  - Exclude repeat attempts (if configured)
  - Drop lowest grades (if configured)
```

### 6. Program Completion

Multi-criteria evaluation:

```
eligible = creditsMet AND gpaMet AND failedModulesOk
         AND durationOk AND thesisOk AND internshipOk
```

## Coverage Target

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

Current status: Run `npm run test:coverage` to see detailed report.

## Common Test Scenarios

### Scenario 1: Swiss Student Retaking Exam

```typescript
// Attempt 1: scores 3.5 (fails, below 4.0)
// Attempt 2: scores 4.5 (passes)
const attempts = [attempt1, attempt2];
const result = resolveEffectiveAttempt(attempts, retakeBestAttempt, chGradeScale);
expect(result.effectiveGrade).toBe(4.5); // Takes best: 4.5
expect(result.canRetake).toBe(true); // Can retry once more
```

### Scenario 2: German Student with Module Prerequisites

```typescript
// Student needs MAT-101 before MAT-201
const prerequisites = [
  { moduleId: "MAT-201", prerequisiteModuleId: "MAT-101", prerequisiteType: "required" }
];

// Check eligibility
const passedModules = new Set(["MAT-101"]);
const result = checkPrerequisites(prerequisites, passedModules);
expect(result.canEnroll).toBe(true);
```

### Scenario 3: UK Student Degree Classification

```typescript
// Student's average across all modules: 68%
const classification = classifyDegree(68, ukClassificationScheme);
expect(classification).toBe("Upper Second Class Honours"); // 2:1
```

### Scenario 4: Cross-Border Grade Conversion

```typescript
// Swiss student (4.2 on 1-6) applies to German university
const converted = convertGrade(4.2, chGradeScale, deGradeScale);
// Result: approximately 2.8 on German 1-5 scale
// Confidence: 0.65 (different systems)
```

## Debugging Failed Tests

### Check Grade Scale Direction

Ensure you're using the correct scale for your test:

```typescript
// Swiss/UK/Italian: higher is better
expect(isPassingGrade(5.0, chGradeScale)).toBe(true);

// German/Austrian: lower is better
expect(isPassingGrade(2.0, deGradeScale)).toBe(true);
```

### Verify Weight Sums

Assessment components must contribute to exactly 100%:

```typescript
const totalWeight = components
  .filter(c => c.contributesToFinal)
  .reduce((sum, c) => sum + c.weightPercent, 0);

expect(totalWeight).toBeCloseTo(100, 2); // Allow 0.01% tolerance
```

### Check Prerequisite Logic

Prerequisites block enrollment:

```typescript
const passedModules = new Set(["required-module"]);
const result = checkPrerequisites(prerequisites, passedModules);
expect(result.canEnroll).toBe(true); // Requires all mandatory prereqs met
```

## Adding New Tests

1. Create test data matching international standards
2. Use realistic grade values for each scale
3. Test both valid and invalid inputs
4. Include integration scenarios
5. Document assumptions in test comments

Example template:

```typescript
it("should [describe expected behavior]", () => {
  // Arrange: Set up test data
  const grade = 4.2;
  const scale = chGradeScale;

  // Act: Call function
  const result = isPassingGrade(grade, scale);

  // Assert: Verify result
  expect(result).toBe(true);
  expect(result).toMatchSnapshot(); // Optional: for output verification
});
```

## References

### Grade Systems
- **Swiss**: SEFRI Federal Office documentation
- **German**: Modifizierte Bayerische Formel (TUM reference)
- **UK**: QAA honours classification framework
- **Italian**: MIUR/CRUI standards

### Academic Standards
- ECTS: European Credit Transfer System
- Bologna Process: Qualification frameworks
- LEAP: Learning Outcomes Assessment Program

## Related Documentation

- `/src/lib/academic/engine.ts` - Calculation implementations
- `/src/lib/academic/validation.ts` - Validation implementations
- `/src/lib/academic/types.ts` - Type definitions
- `vitest.config.ts` - Test configuration
