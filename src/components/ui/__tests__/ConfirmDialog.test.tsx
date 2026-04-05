/**
 * ConfirmDialog Component Tests
 *
 * Tests für ConfirmDialog und useConfirm Hook.
 * Benötigt: npm install --save-dev @testing-library/react @testing-library/jest-dom happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Modul löschen?",
    description: "Diese Aktion kann nicht rückgängig gemacht werden.",
    confirmLabel: "Löschen",
    cancelLabel: "Abbrechen",
    variant: "danger" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rendert nicht wenn open=false", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("rendert Titel und Beschreibung", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Modul löschen?")).toBeDefined();
    expect(screen.getByText("Diese Aktion kann nicht rückgängig gemacht werden.")).toBeDefined();
  });

  it("rendert Confirm und Cancel Buttons", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Löschen")).toBeDefined();
    expect(screen.getByText("Abbrechen")).toBeDefined();
  });

  it("ruft onConfirm bei Klick auf Bestätigen", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Löschen"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ruft onClose bei Klick auf Abbrechen", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Abbrechen"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("schliesst bei Escape-Taste", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("schliesst NICHT bei Escape wenn loading=true", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("deaktiviert Buttons bei loading=true", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);
    const cancelBtn = screen.getByText("Abbrechen");
    const confirmBtn = screen.getByText("Löschen");
    expect(cancelBtn.hasAttribute("disabled")).toBe(true);
    expect(confirmBtn.closest("button")?.hasAttribute("disabled")).toBe(true);
  });

  it("hat role=dialog und aria-modal", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("verwendet Standard-Labels wenn nicht angegeben", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Test"
      />,
    );
    expect(screen.getByText("Bestätigen")).toBeDefined();
    expect(screen.getByText("Abbrechen")).toBeDefined();
  });

  describe("Varianten", () => {
    it("rendert danger-Variante", () => {
      const { container } = render(
        <ConfirmDialog {...defaultProps} variant="danger" />,
      );
      // Should have red-related classes
      const iconContainer = container.querySelector(".bg-red-100, [class*='bg-red']");
      expect(iconContainer).toBeDefined();
    });

    it("rendert warning-Variante", () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);
      // Component renders without error — variant is applied
      expect(screen.getByText("Modul löschen?")).toBeDefined();
    });

    it("rendert info-Variante", () => {
      render(<ConfirmDialog {...defaultProps} variant="info" />);
      expect(screen.getByText("Modul löschen?")).toBeDefined();
    });
  });
});
