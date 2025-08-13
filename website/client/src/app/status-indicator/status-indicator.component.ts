import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  templateUrl: './status-indicator.component.html',
  styleUrls: ['./status-indicator.component.css'],
})
export class StatusIndicatorComponent {
  @Input() statusText: string = 'AI preview app';
}
