import { Directive, ElementRef, inject } from '@angular/core';

const ESCALA_MINIMA = 1;
const ESCALA_MAXIMA = 5;
const ESCALA_TOQUE_DUPLO = 2.5;
const INTERVALO_TOQUE_DUPLO_MS = 300;

interface Ponto {
  x: number;
  y: number;
}

/**
 * Permite ampliar uma imagem com pinça (dois dedos), toque duplo ou roda do mouse,
 * e arrastá-la enquanto estiver ampliada.
 */
@Directive({
  selector: 'img[appZoomImagem]',
  host: {
    draggable: 'false',
    style: 'touch-action: none; transform-origin: 0 0; user-select: none;',
    '(pointerdown)': 'aoPressionar($event)',
    '(pointermove)': 'aoMover($event)',
    '(pointerup)': 'aoSoltar($event)',
    '(pointercancel)': 'aoSoltar($event)',
    '(wheel)': 'aoRolar($event)',
    '(load)': 'resetar()',
    '(dragstart)': '$event.preventDefault()',
  },
})
export class ZoomImagemDirective {
  private readonly elemento = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private readonly ponteiros = new Map<number, Ponto>();

  private escala = 1;
  private x = 0;
  private y = 0;
  private ultimoToque = 0;
  private toqueMoveu = false;

  aoPressionar(event: PointerEvent): void {
    this.elemento.setPointerCapture(event.pointerId);
    this.ponteiros.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.toqueMoveu = this.ponteiros.size > 1;
  }

  aoMover(event: PointerEvent): void {
    const anterior = this.ponteiros.get(event.pointerId);
    if (!anterior) return;

    const atual = { x: event.clientX, y: event.clientY };

    if (this.ponteiros.size === 2) {
      const [a, b] = [...this.ponteiros.values()];
      const outro = a === anterior ? b : a;
      const distanciaAnterior = this.distancia(anterior, outro);
      const centroAnterior = this.centro(anterior, outro);
      const centroAtual = this.centro(atual, outro);

      if (distanciaAnterior > 0) {
        this.ampliar(this.distancia(atual, outro) / distanciaAnterior, centroAtual);
      }
      this.mover(centroAtual.x - centroAnterior.x, centroAtual.y - centroAnterior.y);
    } else if (this.ponteiros.size === 1 && this.escala > 1) {
      this.mover(atual.x - anterior.x, atual.y - anterior.y);
    }

    if (Math.abs(atual.x - anterior.x) + Math.abs(atual.y - anterior.y) > 2) {
      this.toqueMoveu = true;
    }
    this.ponteiros.set(event.pointerId, atual);
    this.aplicar();
  }

  aoSoltar(event: PointerEvent): void {
    if (!this.ponteiros.delete(event.pointerId)) return;
    if (this.ponteiros.size > 0) return;

    if (this.escala <= 1.01) this.resetar();

    if (event.type !== 'pointerup' || this.toqueMoveu) return;

    const agora = Date.now();
    if (agora - this.ultimoToque < INTERVALO_TOQUE_DUPLO_MS) {
      this.ultimoToque = 0;
      if (this.escala > 1) {
        this.resetar();
      } else {
        this.ampliar(ESCALA_TOQUE_DUPLO, { x: event.clientX, y: event.clientY });
        this.aplicar(true);
      }
    } else {
      this.ultimoToque = agora;
    }
  }

  aoRolar(event: WheelEvent): void {
    event.preventDefault();
    this.ampliar(Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY });
    if (this.escala <= 1.01) this.resetar();
    else this.aplicar();
  }

  resetar(): void {
    this.escala = 1;
    this.x = 0;
    this.y = 0;
    this.aplicar(true);
  }

  private ampliar(fator: number, foco: Ponto): void {
    const novaEscala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, this.escala * fator));
    const proporcao = novaEscala / this.escala;
    const base = this.origem();
    const focoX = foco.x - base.x;
    const focoY = foco.y - base.y;

    this.x = focoX - (focoX - this.x) * proporcao;
    this.y = focoY - (focoY - this.y) * proporcao;
    this.escala = novaEscala;
  }

  private mover(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  private aplicar(animar = false): void {
    const largura = this.elemento.offsetWidth;
    const altura = this.elemento.offsetHeight;
    this.x = Math.min(0, Math.max(largura - largura * this.escala, this.x));
    this.y = Math.min(0, Math.max(altura - altura * this.escala, this.y));

    this.elemento.style.transition = animar ? 'transform 0.2s ease-out' : 'none';
    this.elemento.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.escala})`;
  }

  /** Posição do canto superior esquerdo da imagem sem a transformação aplicada. */
  private origem(): Ponto {
    const retangulo = this.elemento.getBoundingClientRect();
    return { x: retangulo.left - this.x, y: retangulo.top - this.y };
  }

  private distancia(a: Ponto, b: Ponto): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private centro(a: Ponto, b: Ponto): Ponto {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
