import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizeComponent } from './visualize.component';

describe('VisualizeComponent', () => {
  let component: VisualizeComponent;
  let fixture: ComponentFixture<VisualizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisualizeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
