import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GatherDataComponent } from './gather-data.component';

describe('GatherDataComponent', () => {
  let component: GatherDataComponent;
  let fixture: ComponentFixture<GatherDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GatherDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GatherDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
