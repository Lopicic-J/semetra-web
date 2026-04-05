/**
 * EmptyState Component Tests
 *
 * Tests für die EmptyState-Komponente (rendering, action button).
 * Benötigt: npm install --save-dev @testing-library/react @testing-library/jest-dom happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("rendert Titel korrekt", () => {
    render(<EmptyState title="Keine Daten vorhanden" />);
    expect(screen.getByText("Keine Daten vorhanden")).toBeDefined();
  });

  it("rendert Beschreibung wenn angegeben", () => {
    render(
      <EmptyState
        title="Leer"
        description="Erstelle dein erstes Modul um loszulegen."
      />,
    );
    expect(screen.getByText("Erstelle dein erstes Modul um loszulegen.")).toBeDefined();
  });

  it("rendert KEINE Beschreibung wenn nicht angegeben", () => {
    const { container } = render(<EmptyState title="Leer" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });

  it("rendert Icon wenn angegeben", () => {
    render(
      <EmptyState
        title="Leer"
        icon={<span data-testid="custom-icon">📚</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeDefined();
  });

  it("rendert Action-Button und löst onClick aus", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Keine Module"
        action={{ label: "Modul erstellen", onClick }}
      />,
    );

    const button = screen.getByText("Modul erstellen");
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("rendert KEINEN Button ohne action-Prop", () => {
    const { container } = render(<EmptyState title="Leer" />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });
});
