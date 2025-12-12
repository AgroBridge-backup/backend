# 🔍 Code Audit Report - AgroBridge Frontend Live Demo

**Date**: December 2, 2025
**Scope**: All recently created/modified files for backend integration
**Auditor**: Claude (Senior Principal Engineer)

---

## 🐛 Critical Bugs Found

### 1. **apiClient.ts:44 - URL Construction Bug**
**Severity**: 🔴 **CRITICAL**
**Location**: `src/lib/apiClient.ts:44`

```typescript
// ❌ CURRENT (BROKEN)
const url = new URL(path, API_BASE_URL);

// ✅ FIXED
const url = new URL(path, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);
```

**Issue**: `new URL('/lots', 'https://api.agrobridge.io')` creates `https://api.agrobridge.io/lots` BUT if base URL doesn't end with `/`, it can fail. Need to ensure proper path joining.

**Better Solution**:
```typescript
const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
const cleanPath = path.startsWith('/') ? path.slice(1) : path;
const url = new URL(cleanPath, baseUrl);
```

**Impact**: API calls may fail with 404 errors
**Priority**: Fix immediately

---

### 2. **useApi.ts - Memory Leak Risk**
**Severity**: 🟠 **HIGH**
**Location**: `src/hooks/useApi.ts:23-35`

```typescript
// ❌ CURRENT (MEMORY LEAK)
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await apiCall();
    setData(result); // ⚠️ Called even if unmounted
  } catch (err) {
    setError(err as ApiError | Error);
  } finally {
    setLoading(false);
  }
};

// ✅ FIXED
useEffect(() => {
  let isMounted = true;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      if (isMounted) {
        setData(result);
      }
    } catch (err) {
      if (isMounted) {
        setError(err as ApiError | Error);
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    isMounted = false;
  };
}, dependencies);
```

**Issue**: If component unmounts during fetch, setState is called on unmounted component
**Impact**: React warnings in console, potential memory leaks
**Priority**: Fix before production

---

### 3. **QrScanner.tsx - setTimeout Memory Leak**
**Severity**: 🟠 **HIGH**
**Location**: `src/components/lotes/QrScanner.tsx:22`

```typescript
// ❌ CURRENT (MEMORY LEAK)
const handleSimulateScan = () => {
  if (!code.trim()) return;
  setIsScanning(true);
  setTimeout(() => {
    onScan(code.trim());
    setIsScanning(false);
  }, 500); // ⚠️ Not cleared on unmount
};

// ✅ FIXED
const handleSimulateScan = () => {
  if (!code.trim()) return;
  setIsScanning(true);

  const timeoutId = setTimeout(() => {
    onScan(code.trim());
    setIsScanning(false);
  }, 500);

  // Store ref to clear on unmount
  timeoutRef.current = timeoutId;
};

useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, []);
```

**Issue**: If user navigates away during scanning animation, timeout continues
**Impact**: setState on unmounted component, potential errors
**Priority**: Fix before production

---

## ⚠️ High Priority Issues

### 4. **useApi.ts - useCallback Not Used**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/hooks/useApi.ts:23`

**Issue**: `fetchData` is recreated on every render but returned as `refetch`. Should use `useCallback` to maintain referential equality.

```typescript
// ✅ BETTER
const fetchData = useCallback(async () => {
  // ... implementation
}, [apiCall]);
```

**Impact**: Parent components calling `refetch` may re-render unnecessarily
**Priority**: Optimize for performance

---

### 5. **apiClient.ts - Content-Type Always Set**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/lib/apiClient.ts:55`

**Issue**: `Content-Type: application/json` is set even for GET requests with no body

```typescript
// ✅ BETTER
const headers: HeadersInit = {};

if (body) {
  headers['Content-Type'] = 'application/json';
}
```

**Impact**: Minor - servers usually ignore it, but not RESTful
**Priority**: Low

---

### 6. **StatsGrid.tsx - Mock Data Still Present**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/components/dashboard/StatsGrid.tsx:38-45`

**Issue**: Trend change percentages are hardcoded (12%, 8%, 5%, etc.)

```typescript
// ❌ CURRENT
change: 12, // Hardcoded

// ✅ SHOULD BE
change: calculateTrendFromHistory(historicalData),
```

**Impact**: Misleading data in demo - investors might notice
**Priority**: Document as "mock" or calculate real trends

---

### 7. **StatsGrid.tsx - Certificaciones Calculation**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/components/dashboard/StatsGrid.tsx:44`

**Issue**: `value: verificados * 2` is arbitrary

```typescript
// ❌ CURRENT
{ label: 'Certificaciones', value: verificados * 2, ... }

// ✅ SHOULD BE
// Fetch actual certificate count from backend
```

**Impact**: Inaccurate data shown to users
**Priority**: Either remove or fetch real data

---

## 🎨 UI/UX Improvements

### 8. **QrScanner.tsx - Deprecated onKeyPress**
**Severity**: 🟢 **LOW**
**Location**: `src/components/lotes/QrScanner.tsx:52`

```typescript
// ❌ DEPRECATED
onKeyPress={handleKeyPress}

// ✅ MODERN
onKeyDown={handleKeyDown}
```

**Issue**: `onKeyPress` is deprecated in React
**Priority**: Fix for modern React practices

---

### 9. **QrScanner.tsx - No Auto-Focus**
**Severity**: 🟢 **LOW**

```typescript
// ✅ IMPROVED UX
<input
  ref={inputRef}
  autoFocus
  // ... rest
/>
```

**Issue**: User has to click into input field
**Impact**: Poor UX - scanning should be instant
**Priority**: Nice to have

---

### 10. **QrScanner.tsx - Button Missing type**
**Severity**: 🟢 **LOW**
**Location**: `src/components/lotes/QrScanner.tsx:59`

```typescript
// ✅ IMPROVED
<button
  type="button" // Prevent form submission
  onClick={handleSimulateScan}
  // ... rest
/>
```

**Issue**: Button might submit form if used in form context
**Priority**: Best practice

---

### 11. **StatsGrid.tsx - No Error UI**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/components/dashboard/StatsGrid.tsx:59-62`

```typescript
// ❌ CURRENT
if (error) {
  console.error('Error loading stats:', error);
  // Fall back to showing zeroed stats if there's an error
}

// ✅ IMPROVED
if (error) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <p className="text-red-500 text-sm">
        Error al cargar estadísticas. Por favor, recarga la página.
      </p>
      <button onClick={refetch} className="mt-2 text-red-400 hover:text-red-300">
        Reintentar
      </button>
    </div>
  );
}
```

**Issue**: Errors silently fall through to showing zeros
**Impact**: Confusing UX - users don't know if it's an error or no data
**Priority**: Improve user feedback

---

## ♿ Accessibility Issues

### 12. **StatsGrid.tsx - Loading Lacks Aria Labels**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/components/dashboard/StatsGrid.tsx:52`

```typescript
// ✅ IMPROVED
<div
  className="..."
  role="status"
  aria-label="Cargando estadísticas"
>
  {[...Array(6)].map((_, i) => (
    <div key={i} className="..." aria-hidden="true" />
  ))}
</div>
```

**Impact**: Screen readers don't announce loading state
**Priority**: WCAG compliance

---

### 13. **QrScanner.tsx - Missing ARIA Labels**
**Severity**: 🟡 **MEDIUM**

```typescript
// ✅ IMPROVED
<input
  type="text"
  value={code}
  aria-label="Código de lote para escanear"
  aria-describedby="qr-hint"
  // ... rest
/>

<p id="qr-hint" className="text-gray-500 text-xs">
  💡 Prueba con códigos como: AVT-2024-001, FRS-2024-001, o lote-001
</p>
```

**Impact**: Poor accessibility for screen reader users
**Priority**: WCAG compliance

---

## 🚀 Performance Optimizations

### 14. **LotesPage.tsx - Multiple Filters**
**Severity**: 🟢 **LOW**
**Location**: `src/pages/LotesPage.tsx:33-35`

**Current**: Stats cards recalculate on every render

```typescript
// ✅ OPTIMIZED
const lotCounts = useMemo(() => ({
  verified: lotes.filter(l => l.status === 'verified').length,
  pending: lotes.filter(l => l.status === 'pending').length,
  rejected: lotes.filter(l => l.status === 'rejected').length,
  total: lotes.length,
}), [lotes]);
```

**Impact**: Minor performance improvement
**Priority**: Nice to have

---

### 15. **StatsGrid.tsx - Inefficient Filters**
**Severity**: 🟢 **LOW**
**Location**: `src/components/dashboard/StatsGrid.tsx:33-35`

**Current**: Multiple `filter()` calls on same array

```typescript
// ❌ CURRENT
const verificados = lots.filter(l => mapBackendStatusToFrontend(l.status) === 'verified').length;
const pendientes = lots.filter(l => mapBackendStatusToFrontend(l.status) === 'pending').length;

// ✅ OPTIMIZED (Single pass)
const stats = lots.reduce((acc, lot) => {
  const status = mapBackendStatusToFrontend(lot.status);
  acc[status]++;
  return acc;
}, { verified: 0, pending: 0, rejected: 0 });
```

**Impact**: O(n) → O(1) for status counting
**Priority**: Optimize for large datasets

---

## 📝 Best Practices & Code Quality

### 16. **api.ts - Unused Function**
**Severity**: 🟢 **LOW**
**Location**: `src/config/api.ts:39`

**Issue**: `buildApiUrl()` is defined but never used

```typescript
// Either remove or use it in apiClient
export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
```

**Priority**: Clean up dead code

---

### 17. **apiClient.ts - No Retry Logic**
**Severity**: 🟡 **MEDIUM**

**Improvement**: Add exponential backoff for failed requests

```typescript
export async function apiRequestWithRetry<TResponse>(
  options: ApiRequestOptions,
  retries = 3,
  backoff = 1000
): Promise<TResponse> {
  try {
    return await apiRequest<TResponse>(options);
  } catch (err) {
    if (retries > 0 && isRetriableError(err)) {
      await delay(backoff);
      return apiRequestWithRetry(options, retries - 1, backoff * 2);
    }
    throw err;
  }
}
```

**Priority**: Resilience improvement

---

### 18. **Type Safety - ApiError vs Error**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/lib/apiClient.ts:90-103`

**Issue**: Non-ApiError exceptions are re-thrown without structure

```typescript
// ✅ IMPROVED
} catch (err) {
  clearTimeout(timeoutId);

  if (err instanceof Error && err.name === 'AbortError') {
    const timeoutError: ApiError = {
      status: 408,
      statusText: 'Request Timeout',
      message: `Request timed out after ${timeout}ms`,
      url: url.toString(),
    };
    throw timeoutError;
  }

  // Wrap unknown errors
  if (!(err as ApiError).status) {
    const wrappedError: ApiError = {
      status: 0,
      statusText: 'Network Error',
      message: err instanceof Error ? err.message : 'Unknown error occurred',
      url: url.toString(),
    };
    throw wrappedError;
  }

  throw err;
}
```

**Impact**: Inconsistent error handling
**Priority**: Improve error consistency

---

## 🎯 Security Considerations

### 19. **No Input Sanitization**
**Severity**: 🟡 **MEDIUM**
**Location**: `src/components/lotes/QrScanner.tsx`

**Issue**: User input is not sanitized before being used

```typescript
// ✅ IMPROVED
const handleSimulateScan = () => {
  const sanitizedCode = code.trim().replace(/[^a-zA-Z0-9-]/g, '');
  if (!sanitizedCode) return;

  onScan(sanitizedCode);
};
```

**Impact**: Potential XSS if code is rendered unsafely
**Priority**: Security best practice

---

### 20. **CORS - No Error Handling**
**Severity**: 🟡 **MEDIUM**

**Improvement**: Detect and provide helpful CORS error messages

```typescript
} catch (err) {
  if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
    throw new ApiError({
      status: 0,
      statusText: 'CORS Error',
      message: 'Cannot connect to API. Check CORS configuration.',
      url: url.toString(),
    });
  }
  // ... rest
}
```

**Priority**: Better developer experience

---

## 📊 Summary

### Critical Issues: 3
- 🔴 URL construction bug (apiClient)
- 🔴 Memory leak in useApi hook
- 🔴 setTimeout leak in QrScanner

### High Priority: 4
- 🟠 useCallback not used in useApi
- 🟠 Content-Type header issue
- 🟠 Mock data in StatsGrid
- 🟠 Arbitrary certificate calculation

### Medium Priority: 8
- 🟡 Deprecated onKeyPress
- 🟡 No error UI in StatsGrid
- 🟡 Missing accessibility labels
- 🟡 No retry logic
- 🟡 Type safety inconsistencies
- 🟡 Input sanitization
- 🟡 CORS error handling
- 🟡 Inefficient filters

### Low Priority: 5
- 🟢 Auto-focus missing
- 🟢 Button type missing
- 🟢 Unused function
- 🟢 Performance optimizations
- 🟢 Code cleanup

---

## ✅ Recommended Actions

### Immediate (Before Demo)
1. ✅ Fix URL construction bug in apiClient
2. ✅ Fix memory leaks (useApi + QrScanner)
3. ✅ Add error UI for StatsGrid
4. ✅ Add accessibility labels

### Short-term (This Week)
5. ✅ Replace mock trend data with "Coming soon"
6. ✅ Fix deprecated onKeyPress
7. ✅ Add input sanitization
8. ✅ Improve error handling

### Medium-term (Next Sprint)
9. Add retry logic for API calls
10. Optimize filter operations
11. Add comprehensive error boundaries
12. Implement proper CORS error detection

---

## 🎓 Lessons Learned

1. **Always cleanup side effects** - useEffect, setTimeout, etc.
2. **URL construction is tricky** - Use path joining utilities
3. **Error states need UI** - Don't just console.log
4. **Accessibility from day 1** - Easier than retrofitting
5. **Mock data should be labeled** - Transparency with stakeholders

---

**Audit Completed**: December 2, 2025
**Next Review**: After fixes are applied
